import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT } from '../converter/system-prompt.js';

describe('system-prompt', () => {
  it('should export a non-empty SYSTEM_PROMPT string', () => {
    assert.equal(typeof SYSTEM_PROMPT, 'string');
    assert.ok(SYSTEM_PROMPT.length > 200);
  });

  it('should include all required phases and architectural guidelines', () => {
    assert.match(SYSTEM_PROMPT, /Phase 1: Reconnaissance/i);
    assert.match(SYSTEM_PROMPT, /Phase 2: Section-by-Section Conversion/i);
    assert.match(SYSTEM_PROMPT, /Phase 3: Assembly/i);
  });

  it('should instruct using Tailwind CDN and viewport meta tag', () => {
    assert.ok(SYSTEM_PROMPT.includes('https://cdn.tailwindcss.com'));
    assert.ok(SYSTEM_PROMPT.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'));
  });

  it('should emphasize mobile-first responsive design and depth limits', () => {
    assert.match(SYSTEM_PROMPT, /mobile-first/i);
    assert.match(SYSTEM_PROMPT, /depth/i);
  });
});
