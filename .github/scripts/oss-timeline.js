// Renders the upstream pull requests as a horizontal `git log --graph`: a main line,
// with each merged PR a branch that forks off and merges back, and each PR still in
// review a dashed branch left open with a pulsing tip. Used by open-source.js.
//
// PRs are spaced evenly in date order rather than placed to scale, so a burst of work
// in one month doesn't pile into one spot. Labels alternate above and below the line,
// which gives each one two slots of width.

const { FONT } = require('./svg-kit');

const WIDTH = 900;
const HEIGHT = 244;
const MAX_PRS = 12;
const LINE_Y = 142;
const RISE = 46;          // how far a branch tip sits from the main line
const SPREAD = 26;        // half-width of a merge bubble
const FIRST_X = 74;
const LAST_X = 806;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const shortDate = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const when = (pr) => (pr.state === 'MERGED' ? pr.mergedAt : pr.createdAt);

function branch(theme, pr, i, x) {
  const side = i % 2 ? 1 : -1;                     // -1 above the line, 1 below
  const tipY = LINE_Y + side * RISE;
  const merged = pr.state === 'MERGED';
  const delay = (0.5 + i * 0.13).toFixed(2);
  const repo = pr.repository.nameWithOwner.split('/')[1];

  const d = merged
    ? `M${x - SPREAD},${LINE_Y} Q${x - SPREAD},${tipY} ${x},${tipY} Q${x + SPREAD},${tipY} ${x + SPREAD},${LINE_Y}`
    : `M${x - SPREAD},${LINE_Y} Q${x - SPREAD},${tipY} ${x},${tipY}`;
  const stroke = merged
    ? `class="draw" pathLength="1" style="animation-delay:${delay}s"`
    : `class="fade" stroke-dasharray="3 3" style="animation-delay:${delay}s"`;

  // Labels sit beyond the tip: above it for upper branches, below for lower ones.
  const near = tipY + side * 18 + (side > 0 ? 4 : 0);
  const far = near + side * 14;
  const tip = merged
    ? `<circle class="pop" style="animation-delay:${delay}s" cx="${x}" cy="${tipY}" r="5.5" fill="${theme.packet}"/>`
    : `<circle cx="${x}" cy="${tipY}" r="5.5" fill="none" stroke="${theme.packet}" stroke-width="1.5" opacity="0">
      <animate attributeName="r" values="5.5;13" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.7;0" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>
    <circle class="pop" style="animation-delay:${delay}s" cx="${x}" cy="${tipY}" r="5.5" fill="${theme.card}" stroke="${theme.packet}" stroke-width="2"/>`;

  return `<g>
    <path ${stroke} d="${d}" fill="none" stroke="${theme.packet}" stroke-width="2" stroke-linecap="round"/>
    ${tip}
    <g class="fade" style="animation-delay:${delay}s">
      <text x="${x}" y="${near}" font-size="11" font-weight="700" text-anchor="middle" fill="${theme.ink}">#${pr.number}<tspan font-weight="400" fill="${theme.muted}"> · ${shortDate(when(pr))}</tspan></text>
      <text x="${x}" y="${far}" font-size="10" text-anchor="middle" fill="${theme.muted}">${repo}</text>
    </g>
  </g>`;
}

function renderTimeline(prs, theme) {
  const merged = prs.filter((pr) => pr.state === 'MERGED').length;
  const shown = [...prs].sort((a, b) => when(a).localeCompare(when(b))).slice(-MAX_PRS);
  const step = shown.length > 1 ? (LAST_X - FIRST_X) / (shown.length - 1) : 0;
  const branches = shown.map((pr, i) => branch(theme, pr, i, FIRST_X + i * step));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Upstream pull requests as a git graph: ${merged} merged, ${prs.length - merged} in review. Latest: ${shown.map((pr) => `${pr.repository.nameWithOwner.split('/')[1]} #${pr.number} ${pr.state === 'MERGED' ? 'merged' : 'in review'}`).join(', ')}.">
  <title>Upstream pull requests — git log --graph</title>
  <style>
    text { font-family: ${FONT}; }
    .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw .5s ease-out forwards; }
    .fade, .pop { opacity: 0; animation: fade .35s ease-out forwards; }
    .pop { transform-box: fill-box; transform-origin: center; animation-name: pop; }
    .main { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.4s ease-out .1s forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fade { to { opacity: 1; } }
    @keyframes pop  { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) {
      .draw, .main { animation: none; stroke-dashoffset: 0; }
      .fade, .pop { animation: none; opacity: 1; }
    }
  </style>

  <text x="40" y="32" font-size="14"><tspan fill="${theme.prompt}" font-weight="700">$</tspan><tspan fill="${theme.ink}" dx="8">git log --graph --author=MohitSAGAR11 upstream</tspan></text>
  <text x="${WIDTH - 40}" y="32" font-size="11" text-anchor="end" fill="${theme.muted}"><tspan fill="${theme.packet}" font-weight="700">${merged}</tspan> merged · <tspan fill="${theme.packet}" font-weight="700">${prs.length - merged}</tspan> in review</text>

  <path class="main" pathLength="1" d="M40,${LINE_Y} H${WIDTH - 66}" stroke="${theme.edge}" stroke-width="2" stroke-linecap="round"/>
  <text x="${WIDTH - 40}" y="${LINE_Y + 4}" font-size="11" font-weight="700" text-anchor="end" fill="${theme.packet}">HEAD</text>

  ${branches.join('\n  ')}
</svg>
`;
}

module.exports = { renderTimeline };
