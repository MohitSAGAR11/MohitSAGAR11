// Renders assets/rag-dark.svg and assets/rag-light.svg, the animated Notebook-LM
// pipeline in the Build Spotlight section. Not run by CI — edit, then run from the
// repo root:
//   node .github/scripts/rag-diagram.js

const fs = require('fs');
const path = require('path');
const { FONT, THEMES, NODE_H, mid, node, arrowMarker, arrows, packet, promptLine } = require('./svg-kit');

const out = process.argv[2] || 'assets';

const WIDTH = 900;
const HEIGHT = 286;
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

const INDEX_CY = INDEX_Y + NODE_H / 2;
const QUERY_CY = QUERY_Y + NODE_H / 2;

// When, as a fraction of CYCLE, each node lights up as its packets arrive.
const FLASH = { store: [0.28, 0.36], rerank: [0.68, 0.76], answer: [0.9, 0.98] };

const stage = (theme, n, y) => node(theme, n, y, { cycle: CYCLE, flash: FLASH[n.id] });

// The index lane is a steady stream on its own clock; negative begins start it mid-flow.
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
  const p = (d, start, end, size) => packet(theme, d, start, end, { cycle: CYCLE, size });
  return [
    p(lane(ask, expand), 0, 0.15, 10),
    ...[-10, 0, 10].map((dy) => p(lane(expand, search, dy), 0.15, 0.32)),
    ...[-5, 5].map((dx) => p(fetch(dx), 0.3, 0.5)),
    ...[-10, 0, 10].map((dy) => p(lane(search, rerank, dy), 0.5, 0.68)),
    p(lane(rerank, answer), 0.74, 0.9, 10),
  ].join('\n  ');
}

function svg(theme) {
  const store = mid(INDEX[3]);
  const search = mid(QUERY[2]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Notebook-LM RAG pipeline. Indexing: ingest, chunk (800 characters, 150 overlap), embed with all-MiniLM-L6-v2, store in Pinecone. Querying: ask, expand to 3 queries, search top 5 for each, LLM rerank, grounded answer.">
  <title>Notebook-LM — advanced RAG pipeline</title>
  <style>text { font-family: ${FONT}; }</style>
  <defs>
    ${arrowMarker(theme)}
  </defs>

  ${promptLine(theme, 'notebook-lm --trace', 'Express · LangChain · Pinecone · OpenRouter', WIDTH)}

  <text x="40" y="${INDEX_Y - 10}" font-size="10" letter-spacing="2" fill="${theme.muted}">INDEX</text>
  <text x="40" y="${QUERY_Y - 10}" font-size="10" letter-spacing="2" fill="${theme.muted}">QUERY</text>

  ${arrows(theme, INDEX, INDEX_CY)}
  ${arrows(theme, QUERY, QUERY_CY)}
  <path d="M${store},${INDEX_Y + NODE_H + 5} V170 H${search} V${QUERY_Y - 6}" fill="none" stroke="${theme.edge}" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#head)"/>

  ${indexStream(theme)}
  ${queryFlow(theme)}

  ${INDEX.map((n) => stage(theme, n, INDEX_Y)).join('\n  ')}
  ${QUERY.map((n) => stage(theme, n, QUERY_Y)).join('\n  ')}
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `rag-${name}.svg`), svg(theme));
}
