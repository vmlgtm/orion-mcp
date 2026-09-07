/**
 * Parses a Figma URL to extract the file key and node ID.
 *
 * Supported formats:
 * - https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
 * - https://www.figma.com/file/:fileKey/:fileName?node-id=:nodeId
 *
 * Node IDs in formats like "10-234", "10:234", or "10%3A234" will be normalized to "10:234".
 *
 * @param {string} url - The Figma URL to parse.
 * @returns {{ fileKey: string, nodeId: string }} The extracted fileKey and normalized nodeId.
 * @throws {Error} If the URL is invalid, missing required components, or not a supported Figma URL.
 */
export function parseFigmaUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid input: Figma URL must be a non-empty string.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
  } catch (err) {
    throw new Error(`Invalid URL format: "${url}". Expected a valid Figma URL.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname.includes('figma.com')) {
    throw new Error(`Invalid host: "${parsedUrl.hostname}". Expected a figma.com URL.`);
  }

  // Match /design/:fileKey or /file/:fileKey
  // Path segments: ['', 'design'|'file', fileKey, ...title]
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const typeIndex = pathParts.findIndex((part) => part === 'design' || part === 'file');

  if (typeIndex === -1 || !pathParts[typeIndex + 1]) {
    throw new Error(
      `Invalid Figma URL path: "${parsedUrl.pathname}". Expected URL path to contain "/design/:fileKey" or "/file/:fileKey".`
    );
  }

  const fileKey = pathParts[typeIndex + 1];

  // Extract node-id or node_id from search params
  const rawNodeId =
    parsedUrl.searchParams.get('node-id') ||
    parsedUrl.searchParams.get('node_id');

  if (!rawNodeId) {
    throw new Error(
      `Missing node-id parameter: URL must include a "node-id" query parameter pointing to a frame (e.g. ?node-id=10:234 or ?node-id=10-234).`
    );
  }

  // Figma encodes colons as '-' in some web links or '%3A' in URL-encoded links.
  // The Figma REST API expects colon-separated node IDs (e.g. "10:234").
  const decodedNodeId = decodeURIComponent(rawNodeId);
  const normalizedNodeId = decodedNodeId.replace(/-/g, ':');

  return {
    fileKey,
    nodeId: normalizedNodeId,
  };
}
