// Renders assets/plan-dark.svg and assets/plan-light.svg, the `cat ~/.plan` card in the
// Focus section — in the spirit of the Unix .plan file. Not run by CI — edit SECTIONS,
// then run from the repo root:
//   node .github/scripts/plan-card.js
//
// Plays once and holds, like the system-info card it sits below. Lines print in down
// each column; the cursor blinks when the last one lands.

const fs = require('fs');
const path = require('path');
const { FONT, THEMES } = require('./svg-kit');

const out = process.argv[2] || 'assets';

// Two columns of sections. Keep items to ~44 characters to fit a column.
const COLUMNS = [
  [
    { heading: 'building', items: [
      'Open Library import fixes — MARC, OPDS',
      'JSON Schema spec-compliance fixes',
      'CodeFang — a coding agent that asks first',
    ] },
    { heading: 'into', items: [
      'system design · distributed systems',
      'RAG & LLM agents · vector search',
      'data structures & algorithms',
    ] },
  ],
  [
    { heading: 'learning', items: [
      'LangGraph — stateful multi-agent flows',
      'MCP — giving agents tools over a protocol',
      'advanced RAG — hybrid search, rerank, eval',
      'AI agents — memory and orchestration',
      'cloud & CI/CD — AWS, Terraform, Actions',
    ] },
  ],
];

const WIDTH = 900;
const COL_X = [28, 474];
const TOP = 100;
const LINE = 22;
const SECTION_GAP = 18;
const STEP = 0.09;        // stagger between printed lines
const START = 0.9;        // after the command has typed

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lays out every line with its position and print order, column by column.
function layout() {
  const lines = [];
  COLUMNS.forEach((sections, col) => {
    let y = TOP;
    sections.forEach((section) => {
      lines.push({ col, y, kind: 'heading', text: section.heading });
      y += LINE + 2;
      section.items.forEach((item) => { lines.push({ col, y, kind: 'item', text: item }); y += LINE; });
      y += SECTION_GAP;
    });
  });
  return lines.map((line, i) => ({ ...line, delay: START + i * STEP }));
}

function svg(theme) {
  const lines = layout();
  const bottom = Math.max(...lines.map((l) => l.y));
  const cursorY = bottom + 40;
  const height = cursorY + 22;
  const end = (lines.at(-1).delay + 0.4).toFixed(2);
  const cmd = 'cat ~/.plan';

  const printed = lines.map((l) => {
    const x = COL_X[l.col];
    const style = `style="animation-delay:${l.delay.toFixed(2)}s"`;
    return l.kind === 'heading'
      ? `<text class="in" ${style} x="${x}" y="${l.y}" font-weight="700" fill="${theme.label}">[${l.text}]</text>`
      : `<text class="in" ${style} x="${x}" y="${l.y}"><tspan fill="${theme.packet}">›</tspan><tspan fill="${theme.ink}" dx="8">${escape(l.text)}</tspan></text>`;
  });

  const summary = COLUMNS.flat().map((s) => `${s.heading}: ${s.items.join('; ')}`).join('. ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-label="${escape(summary).replace(/"/g, '&quot;')}">
  <title>mohit@sagar — ~/.plan</title>
  <style>
    text { font-family: ${FONT}; font-size: 13px; }
    .in { opacity: 0; animation: in .4s cubic-bezier(.2,.7,.2,1) both; }
    .late { opacity: 0; animation: in .3s ease-out ${end}s both; }
    .blink { animation: blink 1.1s steps(1) infinite; }
    @keyframes in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .in, .late { animation: none; opacity: 1; } .blink { animation: none; } }
  </style>
  <defs>
    <mask id="typed" maskUnits="userSpaceOnUse"><rect x="44" y="46" width="0" height="22" fill="#fff">
      <animate attributeName="width" from="0" to="${Math.ceil(cmd.length * 8.4)}" begin="0.2s" dur="0.5s" fill="freeze"/>
    </rect></mask>
  </defs>

  <rect x="1" y="1" width="${WIDTH - 2}" height="${height - 2}" rx="12" fill="${theme.card}" stroke="${theme.edge}" stroke-width="1.5"/>
  <circle cx="24" cy="19" r="5.5" fill="${theme.prompt}"/>
  <circle cx="42" cy="19" r="5.5" fill="${theme.edge}"/>
  <circle cx="60" cy="19" r="5.5" fill="${theme.edge}"/>
  <text x="${WIDTH / 2}" y="23" font-size="12" text-anchor="middle" fill="${theme.muted}">mohit@sagar: ~/.plan</text>
  <line x1="1" y1="37" x2="${WIDTH - 1}" y2="37" stroke="${theme.edge}" stroke-width="1"/>

  <text x="28" y="62" font-weight="700" fill="${theme.prompt}">$</text>
  <g mask="url(#typed)"><text x="44" y="62" font-size="14" fill="${theme.ink}">${cmd}</text></g>

  <line x1="${COL_X[1] - 22}" y1="${TOP - 14}" x2="${COL_X[1] - 22}" y2="${bottom + 6}" stroke="${theme.edge}" stroke-width="1" stroke-dasharray="3 4"/>
  ${printed.join('\n  ')}

  <g class="late">
    <text x="28" y="${cursorY}" font-weight="700" fill="${theme.prompt}">$</text>
    <rect class="blink" x="44" y="${cursorY - 13}" width="8" height="16" fill="${theme.prompt}"/>
  </g>
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `plan-${name}.svg`), svg(theme));
}
