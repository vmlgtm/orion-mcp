import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Creates and connects an MCP client communicating with the `figma-developer-mcp` child process over stdio.
 *
 * @param {string} figmaToken - The Figma Personal Access Token or API key.
 * @returns {Promise<{ client: Client, cleanup: () => Promise<void> }>}
 */
export async function createMcpClient(figmaToken) {
  if (!figmaToken || typeof figmaToken !== 'string') {
    throw new Error('Figma access token is required to initialize Figma MCP client.');
  }

  // Pass token under both FIGMA_API_KEY and FIGMA_ACCESS_TOKEN for compatibility across figma-developer-mcp versions
  const env = {
    ...process.env,
    FIGMA_API_KEY: figmaToken.trim(),
    FIGMA_ACCESS_TOKEN: figmaToken.trim(),
    IMAGE_DIR: process.cwd(),
  };

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'figma-developer-mcp', '--stdio', '--no-telemetry'],
    env,
  });

  const client = new Client(
    {
      name: 'figma-to-html-converter',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      await client.close();
    } catch {
      // Ignore errors on client close
    }
    try {
      await transport.close();
    } catch {
      // Ignore errors on transport close
    }
  };

  const CONNECT_TIMEOUT_MS = 30000;
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Figma MCP server failed to connect within ${CONNECT_TIMEOUT_MS / 1000} seconds.`));
    }, CONNECT_TIMEOUT_MS);
  });

  try {
    await Promise.race([client.connect(transport), timeoutPromise]);
    return { client, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
