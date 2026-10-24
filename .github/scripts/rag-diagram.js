// Renders assets/rag-dark.svg and assets/rag-light.svg, the animated Notebook-LM
// pipeline in the Build spotlight section. Not run by CI — edit, then run from the
// repo root:
//   node .github/scripts/rag-diagram.js
//
// Packets are drawn beneath the nodes, so they show only in the gaps between stages
// and read as passing through each one. Every query-lane animation shares one CYCLE
// and places itself with keyTimes, which keeps the choreography in sync on every loop.

const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'assets';
const FONT = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

const THEMES = {
  dark: {
    ink: '#E6EDF3', muted: '#8B949E', edge: '#30363D', card: '#161B22',
    label: '#FF6B9A', packet: '#FF6B9A', flash: '#FFD6E3', prompt: '#FF6B9A',
  },
  light: {
    ink: '#1F2328', muted: '#59636E', edge: '#D0D7DE', card: '#F6F8FA',
    label: '#6E44C9', packet: '#C2185B', flash: '#FF3D7F', prompt: '#C2185B',
  },
};

const WIDTH = 900;
const HEIGHT = 286;
const NODE_H = 54;
const INDEX_Y = 80;
const QUERY_Y = 206;
const CYCLE = 6;          // seconds per question in the query lane
const STREAM = 3;         // seconds for one chunk to cross the index lane

const INDEX = [
  { x: 40, w: 160, n: '01', title: 'ingest', sub: 'PDF / TXT by page' },
  { x: 250, w: 160, n: '02', title: 'chunk', sub: '800 ch · 150 overlap' },
  { x: 460, w: 160, n: '03', title: 'embed', sub: 'all-MiniLM-L6-v2' },
  { x: 670, w: 190, n: '04', title: 'pinecone', sub: 'namespace per document', id: 'store' },
];

const QUERY = [
  { x: 40, w: 140, n: '05', title: 'ask', sub: 'question + history' },
  { x: 210, w: 140, n: '06', title: 'expand', sub: '1 → 3 queries' },
  { x: 380, w: 140, n: '07', title: 'search', sub: 'top-5 × 3, dedupe' },
  { x: 550, w: 140, n: '08', title: 'rerank', sub: 'LLM scores 0–10', id: 'rerank' },
  { x: 720, w: 140, n: '09', title: 'answer', sub: 'grounded · t=0.1', id: 'answer' },
];

const mid = (node) => node.x + node.w / 2;
const INDEX_CY = INDEX_Y + NODE_H / 2;
const QUERY_CY = QUERY_Y + NODE_H / 2;

// When, as a fraction of CYCLE, each node lights up as its packets arrive.
const FLASH = { store: [0.28, 0.36], rerank: [0.68, 0.76], answer: [0.9, 0.98] };

function node(theme, n, y) {
  const flash = FLASH[n.id];
  const pulse = flash
    ? `<animate attributeName="stroke" values="${theme.edge};${theme.packet};${theme.edge}" keyTimes="0;${flash[0]};${flash[1]}" calcMode="discrete" dur="${CYCLE}s" repeatCount="indefinite"/>`
    : '';
  return `<g>
    <rect x="${n.x}" y="${y}" width="${n.w}" height="${NODE_H}" rx="8" fill="${theme.card}" stroke="${theme.edge}" stroke-width="1.5">${pulse}</rect>
    <text x="${n.x + 12}" y="${y + 23}" font-size="12.5" font-weight="700"><tspan fill="${theme.label}">${n.n}</tspan><tspan fill="${theme.ink}" dx="7">${n.title}</tspan></text>
    <text x="${n.x + 12}" y="${y + 42}" font-size="10.5" fill="${theme.muted}">${n.sub}</text>
  </g>`;
}

function arrows(theme, nodes, cy) {
  return nodes.slice(1).map((n, i) => {
    const from = nodes[i].x + nodes[i].w + 5;
    const to = n.x - 6;
    return `<line x1="${from}" y1="${cy}" x2="${to}" y2="${cy}" stroke="${theme.edge}" stroke-width="1.5" marker-end="url(#head)"/>`;
  }).join('\n  ');
}

// A packet that rides `d` between fractions `start` and `end` of the cycle, hidden otherwise.
function packet(theme, d, start, end, size = 7) {
  const t = `keyTimes="0;${start};${end};1"`;
  return `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="2" fill="${theme.packet}" opacity="0">
    <animateMotion path="${d}" keyPoints="0;0;1;1" ${t} calcMode="linear" dur="${CYCLE}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0;1;0" keyTimes="0;${start};${end}" calcMode="discrete" dur="${CYCLE}s" repeatCount="indefinite"/>
  </rect>`;
}

function indexStream(theme) {
  const d = `M${mid(INDEX[0])},${INDEX_CY} H${mid(INDEX[3])}`;
  return [0, 1, 2].map((i) => `<rect x="-4" y="-4" width="8" height="8" rx="2" fill="${theme.packet}">
    <animateMotion path="${d}" dur="${STREAM}s" begin="-${i}s" repeatCount="indefinite"/>
  </rect>`).join('\n  ');
}

function queryFlow(theme) {
  const [ask, expand, search, rerank, answer] = QUERY.map(mid);
  const store = mid(INDEX[3]);
  const lane = (from, to, dy = 0) => `M${from},${QUERY_CY + dy} H${to}`;
  const fetch = (dx) => `M${store + dx},${INDEX_CY} V170 H${search + dx} V${QUERY_CY}`;
  return [
    packet(theme, lane(ask, expand), 0, 0.15, 10),
    ...[-10, 0, 10].map((dy) => packet(theme, lane(expand, search, dy), 0.15, 0.32)),
    ...[-5, 5].map((dx) => packet(theme, fetch(dx), 0.3, 0.5)),
    ...[-10, 0, 10].map((dy) => packet(theme, lane(search, rerank, dy), 0.5, 0.68)),
    packet(theme, lane(rerank, answer), 0.74, 0.9, 10),
  ].join('\n  ');
}

function svg(theme) {
  const store = mid(INDEX[3]);
  const search = mid(QUERY[2]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Notebook-LM RAG pipeline. Indexing: ingest, chunk (800 characters, 150 overlap), embed with all-MiniLM-L6-v2, store in Pinecone. Querying: ask, expand to 3 queries, search top 5 for each, LLM rerank, grounded answer.">
  <title>Notebook-LM — advanced RAG pipeline</title>
  <style>text { font-family: ${FONT}; }</style>
  <defs>
    <marker id="head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="${theme.edge}"/>
    </marker>
  </defs>

  <text x="40" y="32" font-size="14"><tspan fill="${theme.prompt}" font-weight="700">$</tspan><tspan fill="${theme.ink}" dx="8">notebook-lm --trace</tspan></text>
  <text x="860" y="32" font-size="11" fill="${theme.muted}" text-anchor="end">Express · LangChain · Pinecone · OpenRouter</text>

  <text x="40" y="${INDEX_Y - 10}" font-size="10" letter-spacing="2" fill="${theme.muted}">INDEX</text>
  <text x="40" y="${QUERY_Y - 10}" font-size="10" letter-spacing="2" fill="${theme.muted}">QUERY</text>

  ${arrows(theme, INDEX, INDEX_CY)}
  ${arrows(theme, QUERY, QUERY_CY)}
  <path d="M${store},${INDEX_Y + NODE_H + 5} V170 H${search} V${QUERY_Y - 6}" fill="none" stroke="${theme.edge}" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#head)"/>

  ${indexStream(theme)}
  ${queryFlow(theme)}

  ${INDEX.map((n) => node(theme, n, INDEX_Y)).join('\n  ')}
  ${QUERY.map((n) => node(theme, n, QUERY_Y)).join('\n  ')}
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `rag-${name}.svg`), svg(theme));
}
