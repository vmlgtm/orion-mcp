import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Standard candidate paths for Chromium-based browsers across platforms.
 */
const DEFAULT_CHROME_PATHS = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/brave-browser',
  '/snap/bin/chromium',
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

/**
 * Finds an available Chromium/Chrome executable on the host system.
 *
 * @returns {string|null} Path to the browser binary or null if none found.
 */
export function findChromeExecutable() {
  const envPath = process.env.CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  for (const candidate of DEFAULT_CHROME_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Renders an HTML string in headless Chrome at desktop and mobile viewports,
 * returning base64-encoded PNG screenshots.
 *
 * @param {object} options
 * @param {string} options.html - The complete HTML document string.
 * @param {string} [options.baseDir] - Directory to resolve relative asset paths from (defaults to process.cwd()).
 * @param {function} [options.onProgress] - Optional progress callback.
 * @returns {Promise<{ desktopScreenshotBase64: string|null, mobileScreenshotBase64: string|null }>}
 */
export async function renderHtmlScreenshots({
  html,
  baseDir = process.cwd(),
  onProgress,
}) {
  if (!html || typeof html !== 'string') {
    return { desktopScreenshotBase64: null, mobileScreenshotBase64: null };
  }

  const executablePath = findChromeExecutable();
  if (!executablePath) {
    onProgress?.('Headless Chrome not found on host system. Skipping visual screenshot comparison.');
    return { desktopScreenshotBase64: null, mobileScreenshotBase64: null };
  }

  let browser;
  try {
    onProgress?.('Launching headless Chrome for visual layout inspection...');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Inject <base href="file://..."> so relative image paths like assets/foo.png resolve
    const absoluteBase = path.resolve(baseDir);
    const baseTag = `<base href="file://${absoluteBase.replace(/\\/g, '/')}/">`;
    let preparedHtml = html;
    if (preparedHtml.includes('<head>')) {
      preparedHtml = preparedHtml.replace('<head>', `<head>\n  ${baseTag}`);
    } else if (preparedHtml.includes('<html>')) {
      preparedHtml = preparedHtml.replace('<html>', `<html>\n<head>${baseTag}</head>`);
    } else {
      preparedHtml = `<head>${baseTag}</head>\n${preparedHtml}`;
    }

    // Load HTML content
    await page.setContent(preparedHtml, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Wait for fonts and Tailwind CDN styling to settle
    try {
      await page.evaluateHandle('document.fonts.ready');
    } catch {
      // Ignore font readiness timeout
    }
    // Small delay to allow Tailwind CDN script to finish generating styles
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 1. Desktop Viewport (1280px)
    onProgress?.('Capturing desktop layout screenshot (1280px)...');
    await page.setViewport({
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
    });
    const desktopBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    // 2. Mobile Viewport (375px)
    onProgress?.('Capturing mobile layout screenshot (375px)...');
    await page.setViewport({
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    // Brief settle time after viewport resize
    await new Promise((resolve) => setTimeout(resolve, 300));
    const mobileBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    onProgress?.('Visual layout screenshots successfully captured.');

    return {
      desktopScreenshotBase64: desktopBuffer.toString('base64'),
      mobileScreenshotBase64: mobileBuffer.toString('base64'),
    };
  } catch (err) {
    onProgress?.(`Visual layout capture warning: ${err.message}. Proceeding without visual diff.`);
    return { desktopScreenshotBase64: null, mobileScreenshotBase64: null };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close error
      }
    }
  }
}
