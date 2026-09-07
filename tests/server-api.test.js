import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server/index.js';

describe('server-api', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/health returns 200 with JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('POST /api/convert returns 400 when URLs are missing', async () => {
    const res = await fetch(`${baseUrl}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Missing required parameters'));
  });

  it('POST /api/convert returns 500 when environment tokens are missing', async () => {
    const originalFigma = process.env.FIGMA_ACCESS_TOKEN;
    const originalFigmaKey = process.env.FIGMA_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;

    delete process.env.FIGMA_ACCESS_TOKEN;
    delete process.env.FIGMA_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const res = await fetch(`${baseUrl}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desktopUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
          mobileUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:2',
        }),
      });
      assert.equal(res.status, 500);
      const data = await res.json();
      assert.ok(data.error.includes('Server misconfigured'));
    } finally {
      if (originalFigma) process.env.FIGMA_ACCESS_TOKEN = originalFigma;
      if (originalFigmaKey) process.env.FIGMA_API_KEY = originalFigmaKey;
      if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
    }
  });

  it('GET / serves ui/index.html with status 200', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Figma to Responsive HTML'));
  });
});
