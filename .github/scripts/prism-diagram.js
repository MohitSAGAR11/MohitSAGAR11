// Renders assets/prism-dark.svg and assets/prism-light.svg, the animated PRism review
// funnel in the Build Spotlight section. Not run by CI — edit, then run from the repo root:
//   node .github/scripts/prism-diagram.js
//
// One review per loop: six candidate findings leave pass 1, four are refuted and fall
// out, one is dropped as already posted, one comment lands. The counts are illustrative.

const fs = require('fs');
const path = require('path');
const { FONT, THEMES, NODE_H, mid, node, arrowMarker, arrows, packet, promptLine } = require('./svg-kit');

const out = process.argv[2] || 'assets';

const WIDTH = 900;
const HEIGHT = 200;
const ROW_Y = 76;
const LOOP_Y = 58;
const CYCLE = 7;
const FALL = 58;          // how far a dropped finding falls below the row centre

const STAGES = [
  { x: 40, w: 144, n: '01', title: 'diff', sub: 'each push to a PR' },
  { x: 209, w: 144, n: '02', title: 'find', sub: 'pass 1 · defects', id: 'find' },
  { x: 378, w: 144, n: '03', title: 'refute', sub: 'pass 2 · disprove', id: 'refute' },
  { x: 547, w: 144, n: '04', title: 'dedupe', sub: 'content hash', id: 'dedupe' },
  { x: 716, w: 144, n: '05', title: 'post', sub: 'inline or summary', id: 'post' },
];

const CY = ROW_Y + NODE_H / 2;

// Fractions of CYCLE. `flash` lights a stage's border; `tally` shows its caption.
const FLASH = { find: [0.1, 0.16], refute: [0.3, 0.38], dedupe: [0.5, 0.56], post: [0.7, 0.8] };
const TALLY = [
  { id: 'find', at: 0.16, count: 6, text: 'candidates' },
  { id: 'refute', at: 0.42, count: 4, text: 'refuted' },
  { id: 'dedupe', at: 0.6, count: 1, text: 'seen before' },
  { id: 'post', at: 0.76, count: 1, text: 'comment' },
];

const byId = (id) => STAGES.find((s) => s.id === id);

function flow(theme) {
  const [diff, find, refute, dedupe, post] = STAGES.map(mid);
  const lane = (from, to, dy = 0) => `M${from},${CY + dy} H${to}`;
  const drop = (x) => `M${x},${CY} V${CY + FALL}`;
  const p = (d, start, end, opts = {}) => packet(theme, d, start, end, { cycle: CYCLE, ...opts });
  const dropped = { fill: theme.muted, fade: true, size: 6 };

  return [
    p(lane(diff, find), 0, 0.1, { size: 10 }),
    ...[-15, -9, -3, 3, 9, 15].map((dy) => p(lane(find, refute, dy), 0.14, 0.3, { size: 5 })),
    ...[-18, -6, 6, 18].map((dx, i) => p(drop(refute + dx), 0.32 + i * 0.015, 0.5, dropped)),
    ...[-6, 6].map((dy) => p(lane(refute, dedupe, dy), 0.34, 0.5)),
    p(drop(dedupe), 0.52, 0.66, dropped),
    p(lane(dedupe, post), 0.54, 0.7, { size: 10 }),
    // the next push comes round the top; fingerprints keep this comment from repeating
    p(`M${post},${ROW_Y} V${LOOP_Y} H${diff} V${ROW_Y}`, 0.8, 0.97, { size: 6, fill: theme.muted }),
  ].join('\n  ');
}

function tallies(theme) {
  return TALLY.map(({ id, at, count, text }) => {
    const s = byId(id);
    return `<text x="${mid(s)}" y="${ROW_Y + NODE_H + 52}" font-size="11" text-anchor="middle" fill="${theme.muted}" opacity="0"><tspan fill="${theme.packet}" font-weight="700">${count}</tspan> ${text}
    <animate attributeName="opacity" values="0;1;0" keyTimes="0;${at};0.97" calcMode="discrete" dur="${CYCLE}s" repeatCount="indefinite"/>
  </text>`;
  }).join('\n  ');
}

function svg(theme) {
  const [diff, , , , post] = STAGES.map(mid);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="PRism review pipeline: diff on each push, pass 1 finds defects, pass 2 tries to refute each one, findings already posted are dropped by content hash, survivors are posted inline or in a summary.">
  <title>PRism — find, refute, post</title>
  <style>text { font-family: ${FONT}; }</style>
  <defs>
    ${arrowMarker(theme)}
  </defs>

  ${promptLine(theme, 'prism review owner/repo#123', 'TypeScript · GitHub Action · OpenRouter', WIDTH)}

  ${arrows(theme, STAGES, CY)}
  <path d="M${post},${ROW_Y - 6} V${LOOP_Y} H${diff} V${ROW_Y - 6}" fill="none" stroke="${theme.edge}" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#head)"/>
  <text x="${(diff + post) / 2}" y="${LOOP_Y - 6}" font-size="10" letter-spacing="2" fill="${theme.muted}" text-anchor="middle">NEXT PUSH</text>

  ${flow(theme)}

  ${STAGES.map((s) => node(theme, s, ROW_Y, { cycle: CYCLE, flash: FLASH[s.id] })).join('\n  ')}

  ${tallies(theme)}
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `prism-${name}.svg`), svg(theme));
}
