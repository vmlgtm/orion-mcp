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
 * @param {string} [options.reasoningEffort] - Optional reasoning effort ('none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'). Defaults to OPENAI_REASONING_EFFORT env var or 'high'.
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
  reasoningEffort,
  maxIterations = 25,
}) {
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY in environment or pass openaiApiKey.');
  }

  const activeModel = model || process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  // openai SDK v4 defaults to node-fetch v2, which fails with "Premature close" on Node 22.
  // Use Node's native fetch instead.
  // The SDK's default per-request timeout is 10 minutes, which a single high-effort
  // request can exceed; keep it aligned with the server's overall conversion cap.
  const requestTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 900000;
  const openai = new OpenAI({ apiKey, fetch: globalThis.fetch, timeout: requestTimeoutMs });

  const isReasoningModel =
    activeModel.includes('gpt-5') || activeModel.startsWith('o1') || activeModel.startsWith('o3');
  // gpt-5 / o-series accept reasoning.effort: none | low | medium | high | xhigh | max.
  // Older models reject the `reasoning` field entirely, so it is omitted for them.
  const effectiveEffort = isReasoningModel
    ? reasoningEffort || process.env.OPENAI_REASONING_EFFORT || 'high'
    : undefined;

  onProgress?.('Listing available Figma MCP tools...');
  const { tools } = await mcpClient.listTools();

  // Convert MCP tool schemas to the flat tool shape the /v1/responses API expects
  // (chat.completions nests these under `function`; Responses does not).
  const openaiTools = tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
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

  // Responses API conversation state, accumulated statelessly across iterations.
  const input = [
    {
      role: 'user',
      content: `Convert these two Figma designs into a single responsive HTML page:
- Desktop: ${desktopContext}
- Mobile: ${mobileContext}`,
    },
  ];

  let iterations = 0;
  onProgress?.(
    `Starting agent loop with model: ${activeModel}` +
      (effectiveEffort ? ` (reasoning effort: ${effectiveEffort})` : '')
  );

  while (iterations < maxIterations) {
    iterations++;

    if (iterations > 1) {
      onProgress?.(`Synthesizing responsive HTML layout and Tailwind CSS classes (iteration ${iterations})...`);
    }

    const requestParams = {
      model: activeModel,
      instructions: SYSTEM_PROMPT,
      input,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    };

    if (effectiveEffort) {
      requestParams.reasoning = { effort: effectiveEffort };
    }

    const response = await openai.responses.create(requestParams);

    // Echo every output item (reasoning items included) back into the next request
    // so the model keeps its own context without relying on server-side state.
    input.push(...response.output);

    const functionCalls = response.output.filter((item) => item.type === 'function_call');

    // If the model requested tool calls, execute them
    if (functionCalls.length > 0) {
      for (const toolCall of functionCalls) {
        const toolName = toolCall.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.arguments || '{}');
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

        input.push({
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: toolResultContent,
        });
      }
    } else {
      // Model responded with text; extract final HTML
      onProgress?.('Extracting and assembling final HTML...');
      const rawText = response.output_text || '';
      const html = extractHtml(rawText);
      onProgress?.('HTML conversion completed successfully.');
      return html;
    }
  }

  throw new Error(`Agent loop reached maximum limit of ${maxIterations} iterations without producing final HTML.`);
}
