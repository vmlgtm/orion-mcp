import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertFigmaToHtml } from '../converter/index.js';

describe('converter/index.js validation', () => {
  it('throws error when desktopUrl is missing or invalid', async () => {
    await assert.rejects(
      async () => {
        await convertFigmaToHtml({
          desktopUrl: '',
          mobileUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
        });
      },
      /desktopUrl is required/
    );
  });

  it('throws error when mobileUrl is missing or invalid', async () => {
    await assert.rejects(
      async () => {
        await convertFigmaToHtml({
          desktopUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
          mobileUrl: '',
        });
      },
      /mobileUrl is required/
    );
  });

  it('throws error when figma token is missing in both arguments and environment', async () => {
    const originalFigma = process.env.FIGMA_ACCESS_TOKEN;
    const originalFigmaKey = process.env.FIGMA_API_KEY;
    delete process.env.FIGMA_ACCESS_TOKEN;
    delete process.env.FIGMA_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await convertFigmaToHtml({
            desktopUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
            mobileUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:2',
            openaiApiKey: 'sk-test',
          });
        },
        /Figma access token is missing/
      );
    } finally {
      if (originalFigma) process.env.FIGMA_ACCESS_TOKEN = originalFigma;
      if (originalFigmaKey) process.env.FIGMA_API_KEY = originalFigmaKey;
    }
  });

  it('throws error when OpenAI API key is missing', async () => {
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await convertFigmaToHtml({
            desktopUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:1',
            mobileUrl: 'https://www.figma.com/design/ABC/Test?node-id=1:2',
            figmaToken: 'figd_test',
          });
        },
        /OpenAI API key is missing/
      );
    } finally {
      if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
    }
  });
});
