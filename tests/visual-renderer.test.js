import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findChromeExecutable, renderHtmlScreenshots } from '../converter/visual-renderer.js';

describe('visual-renderer findChromeExecutable', () => {
  it('returns a string path or null without throwing', () => {
    const path = findChromeExecutable();
    assert.ok(path === null || typeof path === 'string');
  });

  it('respects CHROME_EXECUTABLE_PATH if provided', () => {
    const originalEnv = process.env.CHROME_EXECUTABLE_PATH;
    process.env.CHROME_EXECUTABLE_PATH = '/non/existent/chrome/path';
    try {
      // If path does not exist on disk, findChromeExecutable should not return the invalid path
      const result = findChromeExecutable();
      assert.notEqual(result, '/non/existent/chrome/path');
    } finally {
      if (originalEnv) process.env.CHROME_EXECUTABLE_PATH = originalEnv;
      else delete process.env.CHROME_EXECUTABLE_PATH;
    }
  });
});

describe('visual-renderer renderHtmlScreenshots', () => {
  it('returns null screenshots when html is empty or non-string', async () => {
    const result1 = await renderHtmlScreenshots({ html: '' });
    assert.deepEqual(result1, { desktopScreenshotBase64: null, mobileScreenshotBase64: null });

    const result2 = await renderHtmlScreenshots({ html: null });
    assert.deepEqual(result2, { desktopScreenshotBase64: null, mobileScreenshotBase64: null });
  });

  it('renders valid base64 PNG screenshots when Chrome is available', async () => {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
      // Skip live rendering test if host environment lacks Chrome
      return;
    }

    const testHtml = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body style="background:#EB5C57;color:white;padding:20px;">
  <h1>Visual Test Card</h1>
</body>
</html>`;

    const result = await renderHtmlScreenshots({
      html: testHtml,
    });

    assert.ok(result.desktopScreenshotBase64, 'desktopScreenshotBase64 should be populated');
    assert.ok(result.mobileScreenshotBase64, 'mobileScreenshotBase64 should be populated');
    assert.ok(result.desktopScreenshotBase64.length > 500);
    assert.ok(result.mobileScreenshotBase64.length > 500);
  });
});
