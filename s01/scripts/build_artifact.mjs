// Build the branch-routing UI as one self-contained HTML page (for publishing as a claude.ai artifact).
//
//   node scripts/build_artifact.mjs <out.html>
//
// The page loads React 18.3.1 from cdnjs (React 19 ships no browser build; the component works on both) and inlines
// the component, its CSS and the generated routing data. Colour tokens move from .sr to :root so the viewer's own
// light/dark setting applies, downloads are hidden (the artifact viewer blocks them), and the page opens with an
// example case loaded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const out = process.argv[2];
if (!out) { console.error('usage: node scripts/build_artifact.mjs <out.html>'); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const component = path.join(root, 'src', 'ShoulderRouter', 'ShoulderRouter.jsx').replace(/\\/g, '/');
const EXAMPLE = 24; // SAMPLES index: S05 "Secondary adhesive capsulitis (diabetic)", a Phase 1 case
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';

const ENTRY = '\0artifact-entry', JSX = '\0jsx-runtime';
const entryCode = `
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ShoulderRouter from ${JSON.stringify(component)};
createRoot(document.getElementById('root')).render(createElement(StrictMode, null, createElement(ShoulderRouter, {
  storageKey: 'shoulder-router.artifact.v1', applyThemeTo: 'document', allowDownload: false, initialSample: ${EXAMPLE},
})));`;
// The automatic JSX runtime has no browser global, so map jsx() onto React.createElement.
const jsxCode = `
import * as React from 'react';
export const Fragment = React.Fragment;
export function jsx(type, props, key) { return React.createElement(type, key === undefined ? props : { ...props, key }); }
export const jsxs = jsx;
export const jsxDEV = jsx;`;

const result = await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define: { __SR_DOWNLOADS__: 'false' },
  plugins: [
    {
      name: 'artifact-entry',
      enforce: 'pre',
      resolveId(id) {
        if (id === ENTRY) return ENTRY;
        if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return JSX;
        return null;
      },
      load(id) { return id === ENTRY ? entryCode : id === JSX ? jsxCode : null; },
    },
    react(),
  ],
  build: {
    write: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: ENTRY,
      external: ['react', 'react-dom', 'react-dom/client'],
      output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' }, inlineDynamicImports: true },
    },
  },
});
const files = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const js = files.find(f => f.type === 'chunk' && f.isEntry)?.code;
const css = files.filter(f => f.type === 'asset' && f.fileName.endsWith('.css')).map(f => String(f.source)).join('\n');
if (!js || !css) { console.error('build produced no JS or CSS'); process.exit(1); }

// Tokens on :root, so the viewer's data-theme on <html> (and prefers-color-scheme) drive every colour.
const tokens = css
  .replace(/\.sr\{--paper/, ':root{--paper')
  .replace(/\.sr:not\(\[data-theme=(["']?)light\1\]\)/g, ':root:not([data-theme="light"])')
  .replace(/\.sr\[data-theme=(["']?)dark\1\]/g, ':root[data-theme="dark"]');
if (!tokens.startsWith(':root{--paper') && !tokens.includes(':root{--paper')) { console.error('could not move the colour tokens to :root'); process.exit(1); }
const safe = s => s.replace(/<\/(script|style)/gi, '<\\/$1');

const html = `<title>Shoulder CDSS Metro</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap">
<style>
${safe(tokens)}
body{background:var(--paper);color:var(--ink)}
</style>
<div id="root"></div>
<script src="${REACT}"></script>
<script src="${REACT_DOM}"></script>
<script>
${safe(js)}
</script>
`;
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log(`wrote ${out} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
