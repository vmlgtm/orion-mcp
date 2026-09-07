import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml, fetchFigmaFramePreviews } from '../converter/agent-loop.js';

describe('agent-loop extractHtml', () => {
  it('should extract HTML wrapped in markdown code fence', () => {
    const input = `Here is the responsive HTML for your Figma design:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <div class="p-4 md:p-8">Hello World</div>
</body>
</html>
\`\`\`

Let me know if you need anything else!`;

    const html = extractHtml(input);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.endsWith('</html>'));
    assert.ok(html.includes('Hello World'));
  });

  it('should extract raw HTML with DOCTYPE directly in text', () => {
    const input = `<!DOCTYPE html>
<html>
<head><title>Raw HTML</title></head>
<body><main class="text-sm md:text-base">Content</main></body>
</html>`;

    const html = extractHtml(input);
    assert.equal(html, input.trim());
  });

  it('should prefix DOCTYPE if only <html> tags are found', () => {
    const input = `<html lang="en"><head></head><body><div>Card</div></body></html>`;
    const html = extractHtml(input);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<html lang="en">'));
  });

  it('should throw error when input contains no HTML', () => {
    assert.throws(() => extractHtml('Just some plain conversational text without HTML tags.'), /Failed to extract valid HTML/);
  });

  it('should throw error on non-string input', () => {
    assert.throws(() => extractHtml(null), /did not contain text content/);
  });
});

describe('agent-loop fetchFigmaFramePreviews', () => {
  it('should return null previews when figmaToken is not provided', async () => {
    const originalToken = process.env.FIGMA_ACCESS_TOKEN;
    const originalKey = process.env.FIGMA_API_KEY;
    delete process.env.FIGMA_ACCESS_TOKEN;
    delete process.env.FIGMA_API_KEY;

    try {
      const result = await fetchFigmaFramePreviews({
        desktopUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
        mobileUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:2',
      });
      assert.deepEqual(result, { desktopImageUrl: null, mobileImageUrl: null });
    } finally {
      if (originalToken) process.env.FIGMA_ACCESS_TOKEN = originalToken;
      if (originalKey) process.env.FIGMA_API_KEY = originalKey;
    }
  });

  it('should return null previews when URLs cannot be parsed', async () => {
    const result = await fetchFigmaFramePreviews({
      desktopUrl: 'not-a-valid-url',
      mobileUrl: 'also-invalid',
      figmaToken: 'test-token',
    });
    assert.deepEqual(result, { desktopImageUrl: null, mobileImageUrl: null });
  });
});
