import { parseFigmaUrl } from './figma-url-parser.js';
import { createMcpClient } from './mcp-client.js';
import { runAgentLoop } from './agent-loop.js';

/**
 * Converts desktop and mobile Figma frames into a single responsive HTML document with Tailwind CSS.
 *
 * @param {object} options
 * @param {string} options.desktopUrl - Desktop Figma frame URL.
 * @param {string} options.mobileUrl - Mobile Figma frame URL.
 * @param {string} [options.figmaToken] - Figma Personal Access Token. Defaults to FIGMA_ACCESS_TOKEN or FIGMA_API_KEY.
 * @param {string} [options.openaiApiKey] - OpenAI API Key. Defaults to OPENAI_API_KEY.
 * @param {string} [options.model] - Target OpenAI model. Defaults to OPENAI_MODEL or gpt-5.6-luna.
 * @param {string} [options.reasoningEffort] - Reasoning effort ('none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'). Defaults to OPENAI_REASONING_EFFORT or 'high'.
 * @param {function} [options.onProgress] - Callback `(message: string) => void` for streaming progress updates.
 * @returns {Promise<{ html: string }>} Result object containing the responsive HTML string.
 */
export async function convertFigmaToHtml({
  desktopUrl,
  mobileUrl,
  figmaToken,
  openaiApiKey,
  model,
  reasoningEffort,
  onProgress,
}) {
  if (!desktopUrl || typeof desktopUrl !== 'string') {
    throw new Error('desktopUrl is required and must be a valid Figma frame URL string.');
  }

  if (!mobileUrl || typeof mobileUrl !== 'string') {
    throw new Error('mobileUrl is required and must be a valid Figma frame URL string.');
  }

  // Validate and pre-parse URLs to catch URL typos early
  onProgress?.('Validating Figma frame URLs...');
  parseFigmaUrl(desktopUrl);
  parseFigmaUrl(mobileUrl);

  const effectiveFigmaToken =
    figmaToken || process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_API_KEY;

  if (!effectiveFigmaToken) {
    throw new Error(
      'Figma access token is missing. Please provide "figmaToken" or set FIGMA_ACCESS_TOKEN / FIGMA_API_KEY in the environment.'
    );
  }

  const effectiveOpenaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!effectiveOpenaiKey) {
    throw new Error(
      'OpenAI API key is missing. Please provide "openaiApiKey" or set OPENAI_API_KEY in the environment.'
    );
  }

  onProgress?.('Spawning Figma Developer MCP server...');
  const { client, cleanup } = await createMcpClient(effectiveFigmaToken);

  try {
    const html = await runAgentLoop({
      mcpClient: client,
      desktopUrl,
      mobileUrl,
      onProgress,
      openaiApiKey: effectiveOpenaiKey,
      model,
      reasoningEffort,
    });

    return { html };
  } finally {
    onProgress?.('Cleaning up Figma MCP server process...');
    await cleanup();
  }
}
