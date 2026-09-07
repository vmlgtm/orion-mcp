import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFigmaUrl } from '../converter/figma-url-parser.js';

describe('figma-url-parser', () => {
  it('should parse standard /design/ URL with dash-separated node-id', () => {
    const url = 'https://www.figma.com/design/ABC123def/My-Page?node-id=10-234';
    const result = parseFigmaUrl(url);
    assert.deepEqual(result, {
      fileKey: 'ABC123def',
      nodeId: '10:234',
    });
  });

  it('should parse legacy /file/ URL with URL-encoded node-id', () => {
    const url = 'https://www.figma.com/file/XYZ789ghi/My-File?node-id=10%3A567';
    const result = parseFigmaUrl(url);
    assert.deepEqual(result, {
      fileKey: 'XYZ789ghi',
      nodeId: '10:567',
    });
  });

  it('should parse URL with colon-separated node-id and additional query params', () => {
    const url = 'https://www.figma.com/design/TestKey123/Project-Name?node-id=4:12&t=abcdef123&scaling=scale-down';
    const result = parseFigmaUrl(url);
    assert.deepEqual(result, {
      fileKey: 'TestKey123',
      nodeId: '4:12',
    });
  });

  it('should support node_id with underscore query parameter', () => {
    const url = 'https://figma.com/design/ABC999/Home?node_id=12-34';
    const result = parseFigmaUrl(url);
    assert.deepEqual(result, {
      fileKey: 'ABC999',
      nodeId: '12:34',
    });
  });

  it('should throw error on missing URL or empty string', () => {
    assert.throws(() => parseFigmaUrl(''), /Invalid input/);
    assert.throws(() => parseFigmaUrl(null), /Invalid input/);
  });

  it('should throw error on malformed URL', () => {
    assert.throws(() => parseFigmaUrl('not-a-url'), /Invalid URL format/);
  });

  it('should throw error on non-figma host', () => {
    assert.throws(
      () => parseFigmaUrl('https://example.com/design/ABC?node-id=10:234'),
      /Expected a figma.com URL/
    );
  });

  it('should throw error if path lacks /design/ or /file/', () => {
    assert.throws(
      () => parseFigmaUrl('https://www.figma.com/other/ABC?node-id=10:234'),
      /Invalid Figma URL path/
    );
  });

  it('should throw error if node-id is missing', () => {
    assert.throws(
      () => parseFigmaUrl('https://www.figma.com/design/ABC123def/My-Page'),
      /Missing node-id parameter/
    );
  });
});
