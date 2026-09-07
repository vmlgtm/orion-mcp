# Figma-to-HTML MCP Converter

A self-serve tool that converts Figma designs into production-ready, responsive HTML + Tailwind CSS pages. It takes **two Figma frames** (one desktop layout and one mobile layout) and merges them into a **single responsive HTML page** using mobile-first Tailwind CSS breakpoint classes (`md:`, `lg:`).

Powered by the **Model Context Protocol (MCP)** via [`figma-developer-mcp`](https://www.npmjs.com/package/figma-developer-mcp) running as a local child process over `stdio`, paired with an OpenAI function-calling agent loop.

---

## Features

- **No Whitelisting Required**: Runs the Figma MCP server locally over `stdio` using only your Figma Personal Access Token (PAT).
- **Portable Converter Core**: The `converter/` package has zero dependencies on Express or the UI and can be copied directly into other Node.js backends or CLI pipelines.
- **Section-by-Section Reasoning**: Progressively inspects frame structure at limited depths rather than dumping entire Figma trees, avoiding token limits.
- **Responsive Fusion**: Combines desktop and mobile Figma variants into a unified mobile-first Tailwind HTML layout.
- **Live SSE Streaming**: Streams real-time progress updates directly to the web UI.
- **Interactive Multi-Breakpoint Preview**: Viewport switcher (Desktop `100%`, Tablet `768px`, Mobile `375px`) directly in the browser with one-click copy and file download.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (UI)                       │
│                                                     │
│  [Desktop Figma URL]  [Mobile Figma URL]  [Convert] │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │           Live HTML Preview (iframe)         │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/convert (JSON)
                       │ + SSE stream for progress
                       ▼
┌─────────────────────────────────────────────────────┐
│              Express Backend (server/)               │
│                                                     │
│  POST /api/convert                                  │
│    │                                                │
│    ▼                                                │
│  mcp-agent.js                                       │
│    │  1. Spawn figma-developer-mcp (stdio)          │
│    │  2. Connect via MCP Client SDK                 │
│    │  3. Run agent loop (OpenAI function calling)   │
│    │  4. Progressive inspection:                    │
│    │     - Desktop frame (depth=1) → skeleton       │
│    │     - Mobile frame (depth=1) → skeleton        │
│    │     - Per-section deep dive on both             │
│    │     - Merge into responsive Tailwind HTML       │
│    │  5. Return final HTML string                   │
│    │                                                │
│    │  stdio ↕                                       │
│    ▼                                                │
│  [Child Process: figma-developer-mcp]               │
│    │  HTTPS                                         │
│    ▼                                                │
│  [Figma REST API (api.figma.com)]                   │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
.
├── .env.example              # Template for required environment variables
├── .gitignore
├── package.json              # Project dependencies and npm scripts
├── README.md
│
├── converter/                # ★ PORTABLE UNIT (zero dependencies on server/ or ui/)
│   ├── index.js              # Exports: convertFigmaToHtml(options)
│   ├── mcp-client.js         # Figma MCP subprocess lifecycle management
│   ├── agent-loop.js         # OpenAI function-calling agent loop & HTML extraction
│   ├── system-prompt.js      # Expert frontend instructions for responsive Tailwind
│   └── figma-url-parser.js   # Parses fileKey and nodeId from Figma URLs
│
├── server/
│   └── index.js              # Express API server with SSE endpoint and static UI host
│
├── ui/
│   └── index.html            # Standalone browser UI with Tailwind CSS CDN
│
└── tests/                    # Automated test suite
    ├── figma-url-parser.test.js
    ├── system-prompt.test.js
    ├── agent-loop.test.js
    └── server-api.test.js
```

---

## Getting Started

### 1. Prerequisites
- Node.js >= 18.0.0 (tested with v22+)
- A Figma Personal Access Token ([Figma Token Docs](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens))
- An OpenAI API Key ([OpenAI Platform](https://platform.openai.com/api-keys))

### 2. Installation
```bash
git clone <repo-url>
cd orion-mcp
npm install
```

### 3. Environment Setup
Copy the example file and provide your credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```env
FIGMA_ACCESS_TOKEN=figd_your_figma_personal_access_token
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_MODEL=gpt-5.6-luna
PORT=3456
```

### 4. Run the Development Server
```bash
npm run dev
```

Visit [http://localhost:3456](http://localhost:3456) in your browser.

---

## Programmatic Usage

The `converter/` module can be imported and executed in any Node.js project:

```javascript
import { convertFigmaToHtml } from './converter/index.js';

const { html } = await convertFigmaToHtml({
  desktopUrl: 'https://www.figma.com/design/ABC123def/My-Design?node-id=10:234',
  mobileUrl: 'https://www.figma.com/design/ABC123def/My-Design?node-id=10:567',
  figmaToken: process.env.FIGMA_ACCESS_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.6-luna', // or 'gpt-4o'
  onProgress: (status) => console.log(status),
});

console.log('Generated responsive HTML:\n', html);
```

---

## Running Tests

Run the built-in Node test suite:

```bash
npm test
```

---

## License

MIT
