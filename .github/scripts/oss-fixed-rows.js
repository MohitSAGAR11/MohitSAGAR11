// Renders "Found it → fixed it" as one animated row per bug: the issue USER reported,
// a packet running along an arrow to the fixing PR, and the PR's status. Used by
// open-source.js, which writes the SVGs and the README block every day.
//
// Each row is its own image so it can link to its pull request.

const { FONT } = require('./svg-kit');

const WIDTH = 900;
const HEIGHT = 56;
const MAX_TITLE = 80;
const ARROW = { from: 610, to: 740, y: 24 };
const FLOW = 2.4;         // seconds for a packet to travel issue → PR

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s) => (s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE - 1)}…` : s);

function status(theme, merged, x, y, begin) {
  if (merged) {
    return `<text x="${x}" y="${y}" font-size="11" font-weight="700" fill="${theme.packet}">merged ✓</text>`;
  }
  return `<circle cx="${x + 4}" cy="${y - 4}" r="3.5" fill="${theme.packet}">
      <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" begin="${begin}s" repeatCount="indefinite"/>
    </circle>
    <text x="${x + 14}" y="${y}" font-size="11" fill="${theme.muted}">in review</text>`;
}

// `fix` is { repo, issue, pr, merged }: issue and pr carry number, title and url.
function renderFixedRow(fix, theme, index) {
  const begin = (index * 0.4).toFixed(1);
  const { from, to, y } = ARROW;
  const label = `${fix.repo}#${fix.issue.number}: ${fix.issue.title}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escape(`Reported ${label}. Fixed in pull request #${fix.pr.number}, ${fix.merged ? 'merged' : 'in review'}.`)}">
  <title>${escape(`${label} → #${fix.pr.number}`)}</title>
  <style>text { font-family: ${FONT}; }</style>
  <defs>
    <marker id="head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="${theme.edge}"/>
    </marker>
  </defs>

  <text x="40" y="22" font-size="12.5"><tspan fill="${theme.ink}" font-weight="700">${escape(fix.repo)}#${fix.issue.number}</tspan><tspan fill="${theme.muted}" dx="8">reported</tspan></text>
  <text x="40" y="41" font-size="11" fill="${theme.muted}">${escape(clip(fix.issue.title))}</text>

  <text x="${(from + to) / 2}" y="${y - 8}" font-size="10" letter-spacing="1.5" text-anchor="middle" fill="${theme.muted}">FIXED IN</text>
  <line x1="${from}" y1="${y}" x2="${to}" y2="${y}" stroke="${theme.edge}" stroke-width="1.5" marker-end="url(#head)"/>
  <rect x="-3.5" y="-3.5" width="7" height="7" rx="2" fill="${theme.packet}">
    <animateMotion path="M${from},${y} H${to - 8}" keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear" dur="${FLOW}s" begin="${begin}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.5;0.6;1" dur="${FLOW}s" begin="${begin}s" repeatCount="indefinite"/>
  </rect>

  <text x="760" y="22" font-size="12.5" font-weight="700" fill="${theme.packet}">#${fix.pr.number}</text>
  ${status(theme, fix.merged, 760, 41, begin)}
  <line x1="40" y1="${HEIGHT - 1}" x2="${WIDTH - 40}" y2="${HEIGHT - 1}" stroke="${theme.edge}" stroke-width="1" stroke-dasharray="4 5"/>
</svg>
`;
}

module.exports = { renderFixedRow };
