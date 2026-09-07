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

  it('should enforce strict design fidelity and forbid brand extrapolation', () => {
    assert.match(SYSTEM_PROMPT, /STRICT DESIGN FIDELITY/i);
    assert.match(SYSTEM_PROMPT, /ZERO BRAND EXTRAPOLATION/i);
    assert.match(SYSTEM_PROMPT, /landing pages intentionally omit/i);
  });

  it('should ban CSS absolute positioning for layout and rigid heights', () => {
    assert.match(SYSTEM_PROMPT, /NEVER USE ABSOLUTE POSITIONING FOR SECTION LAYOUT/i);
    assert.match(SYSTEM_PROMPT, /NO RIGID CONTAINER HEIGHTS/i);
  });

  it('should guide downloading assets using download_figma_images', () => {
    assert.ok(SYSTEM_PROMPT.includes('download_figma_images'));
    assert.ok(SYSTEM_PROMPT.includes('.svg'));
    assert.ok(SYSTEM_PROMPT.includes('.png'));
  });

  it('should enforce interactive states on clickable elements', () => {
    assert.match(SYSTEM_PROMPT, /INTERACTIVE FIDELITY/i);
    assert.match(SYSTEM_PROMPT, /active:scale/i);
    assert.match(SYSTEM_PROMPT, /hover:opacity/i);
  });

  it('should enforce production form hygiene and mobile keyboard ergonomics', () => {
    assert.match(SYSTEM_PROMPT, /PRODUCTION FORM HYGIENE/i);
    assert.match(SYSTEM_PROMPT, /autocomplete/i);
    assert.match(SYSTEM_PROMPT, /inputmode/i);
    assert.match(SYSTEM_PROMPT, /sr-only/i);
  });

  it('should instruct CLS prevention and image performance optimization', () => {
    assert.match(SYSTEM_PROMPT, /PREVENT CUMULATIVE LAYOUT SHIFT/i);
    assert.match(SYSTEM_PROMPT, /aspect-/i);
    assert.match(SYSTEM_PROMPT, /fetchpriority/i);
    assert.match(SYSTEM_PROMPT, /loading="lazy"/i);
  });

  it('should guide centralizing design tokens in tailwind.config', () => {
    assert.match(SYSTEM_PROMPT, /tailwind\.config/i);
    assert.match(SYSTEM_PROMPT, /theme\.extend/i);
  });

  it('should include explicit Auto-Layout transpilation mapping table', () => {
    assert.match(SYSTEM_PROMPT, /AUTO-LAYOUT TRANSPILATION TABLE/i);
    assert.match(SYSTEM_PROMPT, /layoutMode == "VERTICAL"/i);
    assert.match(SYSTEM_PROMPT, /layoutMode == "HORIZONTAL"/i);
    assert.match(SYSTEM_PROMPT, /primaryAxisAlignItems/i);
  });

  it('should strictly prohibit exporting text as images and enforce live semantic HTML', () => {
    assert.match(SYSTEM_PROMPT, /PROHIBIT TEXT-AS-IMAGES/i);
    assert.match(SYSTEM_PROMPT, /NEVER export text headings/i);
  });

  it('should include visual reference grounding instruction', () => {
    assert.match(SYSTEM_PROMPT, /VISUAL REFERENCE GROUNDING/i);
  });
});
