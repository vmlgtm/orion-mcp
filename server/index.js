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

const assetsDir = path.resolve(__dirname, '../assets');
app.use('/assets', express.static(assetsDir));
app.use(express.static(assetsDir));

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

  console.log(`\n[API /api/convert] Starting conversion...`);
  console.log(`- Desktop URL: ${desktopUrl}`);
  console.log(`- Mobile URL:  ${mobileUrl}`);

  // Set socket to send immediately without Nagle buffering
  req.socket?.setNoDelay(true);

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering if behind nginx
  res.flushHeaders?.();

  res.on('close', () => {
    if (!res.writableEnded) {
      console.log('[API /api/convert] Client disconnected before completion');
    }
  });

  const sendEvent = (event, data) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') {
      res.flush();
    }
  };

  sendEvent('progress', { message: 'Conversion request received. Preparing environment...' });

  // High reasoning effort makes runs substantially longer than the original 3 minutes,
  // so this is configurable. Set CONVERSION_TIMEOUT_MS=0 to disable the cap entirely.
  const parsedTimeout = Number(process.env.CONVERSION_TIMEOUT_MS);
  const TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout >= 0 ? parsedTimeout : 900000;
  let timeoutId;

  const timeoutPromise = TIMEOUT_MS > 0
    ? new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Conversion timed out after ${Math.round(TIMEOUT_MS / 1000)}s. ` +
                'Raise CONVERSION_TIMEOUT_MS, lower OPENAI_REASONING_EFFORT, or check frame complexity.'
            )
          );
        }, TIMEOUT_MS);
      })
    : null;

  try {
    const conversionPromise = convertFigmaToHtml({
      desktopUrl,
      mobileUrl,
      figmaToken,
      openaiApiKey,
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      reasoningEffort: process.env.OPENAI_REASONING_EFFORT,
      onProgress: (message) => {
        console.log(`[PROGRESS] ${message}`);
        sendEvent('progress', { message });
      },
    });

    const { html } = timeoutPromise
      ? await Promise.race([conversionPromise, timeoutPromise])
      : await conversionPromise;

    console.log(`[API /api/convert] SUCCESS! Generated HTML (${html.length} chars). Sending done event.`);
    sendEvent('done', { html });
    res.end();
  } catch (err) {
    console.error(`[API /api/convert] ERROR:`, err.message);
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
