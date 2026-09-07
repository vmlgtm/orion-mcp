import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertFigmaToHtml } from '../converter/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files from ui/
const uiDir = path.resolve(__dirname, '../ui');
app.use(express.static(uiDir));

// Serve downloaded Figma images and public assets
const publicDir = path.resolve(__dirname, '../public');
app.use('/public', express.static(publicDir));
app.use(express.static(publicDir));

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: Boolean(
      (process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_API_KEY) &&
      process.env.OPENAI_API_KEY
    ),
  });
});

/**
 * POST /api/convert
 * Streams SSE events: progress, done, error
 */
app.post('/api/convert', async (req, res) => {
  const { desktopUrl, mobileUrl } = req.body || {};

  if (!desktopUrl || !mobileUrl) {
    return res.status(400).json({
      error: 'Missing required parameters: "desktopUrl" and "mobileUrl" are both required.',
    });
  }

  const figmaToken = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!figmaToken || !openaiApiKey) {
    return res.status(500).json({
      error: 'Server misconfigured: FIGMA_ACCESS_TOKEN and OPENAI_API_KEY must be configured on the server.',
    });
  }

  // Set socket to send immediately without Nagle buffering
  req.socket?.setNoDelay(true);

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering if behind nginx
  res.flushHeaders?.();

  let clientConnected = true;
  req.on('close', () => {
    clientConnected = false;
  });

  const sendEvent = (event, data) => {
    if (!clientConnected || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Flush if compression/buffering middleware is present
    if (typeof res.flush === 'function') {
      res.flush();
    }
  };

  sendEvent('progress', { message: 'Conversion request received. Preparing environment...' });

  const TIMEOUT_MS = 180000; // 3 minutes timeout
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Conversion timed out after 3 minutes. Please try again or check frame complexity.'));
    }, TIMEOUT_MS);
  });

  try {
    const conversionPromise = convertFigmaToHtml({
      desktopUrl,
      mobileUrl,
      figmaToken,
      openaiApiKey,
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      onProgress: (message) => {
        sendEvent('progress', { message });
      },
    });

    const { html } = await Promise.race([conversionPromise, timeoutPromise]);

    sendEvent('done', { html });
    res.end();
  } catch (err) {
    sendEvent('error', {
      error: err.message || 'An unexpected error occurred during conversion.',
    });
    res.end();
  } finally {
    clearTimeout(timeoutId);
  }
});

// Fallback for SPA routing to serve ui/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(uiDir, 'index.html'));
});

// Run server directly if executed as main file
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const PORT = process.env.PORT || 3456;
  app.listen(PORT, () => {
    console.log(`Figma-to-HTML server running at http://localhost:${PORT}`);
  });
}
