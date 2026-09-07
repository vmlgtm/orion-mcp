import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { parseFigmaUrl } from './figma-url-parser.js';

/**
 * Extracts and cleans HTML code from an LLM response string.
 *
 * @param {string} text - The raw text from the LLM.
 * @returns {string} Clean HTML string.
 */
export function extractHtml(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('LLM response did not contain text content.');
  }

  // If wrapped in markdown code fence (e.g. ```html ... ```)
  const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;

  // Extract from <!DOCTYPE html to </html>
  const docTypeMatch = candidate.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i);
  if (docTypeMatch) {
    return docTypeMatch[1].trim();
  }

  // Extract from <html to </html>
  const htmlTagMatch = candidate.match(/(<html[\s\S]*?<\/html>)/i);
  if (htmlTagMatch) {
    return `<!DOCTYPE html>\n${htmlTagMatch[1].trim()}`;
  }

  // Fallback if trimmed candidate starts with DOCTYPE or <html>
  const trimmed = candidate.trim();
  if (trimmed.toLowerCase().startsWith('<!doctype html') || trimmed.toLowerCase().startsWith('<html')) {
    return trimmed;
  }

  // If response contains basic html tags
  if (trimmed.includes('<body') || trimmed.includes('<div') || trimmed.includes('<main')) {
    return trimmed;
  }

  throw new Error('Failed to extract valid HTML from LLM response.');
}

/**
 * Executes the OpenAI function calling loop with the Figma MCP client.
 *
 * @param {object} options
 * @param {object} options.mcpClient - Connected MCP Client instance.
 * @param {string} options.desktopUrl - Desktop Figma frame URL.
 * @param {string} options.mobileUrl - Mobile Figma frame URL.
 * @param {function} [options.onProgress] - Optional progress callback `(msg: string) => void`.
 * @param {string} [options.openaiApiKey] - Optional OpenAI API key (defaults to env var).
 * @param {string} [options.model] - Optional OpenAI model (defaults to OPENAI_MODEL env var or gpt-5.6-luna).
 * @param {number} [options.maxIterations=25] - Max loop iterations.
 * @returns {Promise<string>} The generated responsive HTML.
 */
export async function runAgentLoop({
  mcpClient,
  desktopUrl,
  mobileUrl,
  onProgress,
  openaiApiKey,
  model,
  maxIterations = 25,
}) {
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY in environment or pass openaiApiKey.');
  }

  const activeModel = model || process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const openai = new OpenAI({ apiKey });

  onProgress?.('Listing available Figma MCP tools...');
  const { tools } = await mcpClient.listTools();

  // Convert MCP tool schemas to OpenAI function calling format
  const openaiTools = tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));

  // Parse URLs to provide helpful context to the agent
  let desktopContext = desktopUrl;
  let mobileContext = mobileUrl;
  try {
    const d = parseFigmaUrl(desktopUrl);
    desktopContext = `${desktopUrl} (fileKey: "${d.fileKey}", nodeId: "${d.nodeId}")`;
  } catch {
    // Keep raw URL if parse fails
  }
  try {
    const m = parseFigmaUrl(mobileUrl);
    mobileContext = `${mobileUrl} (fileKey: "${m.fileKey}", nodeId: "${m.nodeId}")`;
  } catch {
    // Keep raw URL if parse fails
  }

  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Convert these two Figma designs into a single responsive HTML page:
- Desktop: ${desktopContext}
- Mobile: ${mobileContext}`,
    },
  ];

  let iterations = 0;
  onProgress?.('Starting agent loop with model: ' + activeModel);

  while (iterations < maxIterations) {
    iterations++;

    if (iterations > 1) {
      onProgress?.(`Synthesizing responsive HTML layout and Tailwind CSS classes (iteration ${iterations})...`);
    }

    const requestParams = {
      model: activeModel,
      messages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    };

    // gpt-5 and o-series reasoning models require reasoning_effort: 'none' when function tools are used in /v1/chat/completions
    if (activeModel.includes('gpt-5') || activeModel.startsWith('o1') || activeModel.startsWith('o3')) {
      requestParams.reasoning_effort = 'none';
    }

    let response;
    try {
      response = await openai.chat.completions.create(requestParams);
    } catch (err) {
      if (err.message && (err.message.includes("reasoning_effort to 'none'") || err.message.includes('reasoning_effort'))) {
        requestParams.reasoning_effort = 'none';
        response = await openai.chat.completions.create(requestParams);
      } else if (err.message && err.message.includes('Unrecognized request argument supplied: reasoning_effort')) {
        delete requestParams.reasoning_effort;
        response = await openai.chat.completions.create(requestParams);
      } else {
        throw err;
      }
    }

    const choice = response.choices[0];
    const message = choice.message;
    messages.push(message);

    // If the model requested tool calls, execute them
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (err) {
          toolArgs = {};
        }

        const argsSummary = Object.keys(toolArgs).length > 0
          ? ` (${Object.entries(toolArgs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})`
          : '';
        onProgress?.(`Executing ${toolName}${argsSummary}...`);

        let toolResultContent;
        try {
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          // Spec note: Use JSON.stringify(result.content) when passing MCP results back to OpenAI
          toolResultContent = JSON.stringify(result?.content ?? result);
        } catch (toolErr) {
          toolResultContent = JSON.stringify({
            error: toolErr.message || 'Tool execution failed',
          });
          onProgress?.(`Warning: Tool ${toolName} failed: ${toolErr.message}`);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResultContent,
        });
      }
    } else {
      // Model responded with text; extract final HTML
      onProgress?.('Extracting and assembling final HTML...');
      const rawText = message.content || '';
      const html = extractHtml(rawText);
      onProgress?.('HTML conversion completed successfully.');
      return html;
    }
  }

  throw new Error(`Agent loop reached maximum limit of ${maxIterations} iterations without producing final HTML.`);
}
