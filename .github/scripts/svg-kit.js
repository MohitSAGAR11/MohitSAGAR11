// Shared pieces for the hand-run diagram generators (rag-diagram.js, prism-diagram.js):
// palette, stage boxes, arrows and SMIL packets.
//
// Every timed animation runs on one cycle and places itself with keyTimes, so a whole
// diagram stays in sync on every loop. Packets are meant to be drawn beneath the stage
// boxes: they show only in the gaps and read as passing through each stage.

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

const NODE_H = 54;

const mid = (node) => node.x + node.w / 2;

// Stage box. `flash` is [start, end] as fractions of `cycle`: the border lights up then.
function node(theme, n, y, { cycle, flash } = {}) {
  const pulse = flash
    ? `<animate attributeName="stroke" values="${theme.edge};${theme.packet};${theme.edge}" keyTimes="0;${flash[0]};${flash[1]}" calcMode="discrete" dur="${cycle}s" repeatCount="indefinite"/>`
    : '';
  return `<g>
    <rect x="${n.x}" y="${y}" width="${n.w}" height="${NODE_H}" rx="8" fill="${theme.card}" stroke="${theme.edge}" stroke-width="1.5">${pulse}</rect>
    <text x="${n.x + 12}" y="${y + 23}" font-size="12.5" font-weight="700"><tspan fill="${theme.label}">${n.n}</tspan><tspan fill="${theme.ink}" dx="7">${n.title}</tspan></text>
    <text x="${n.x + 12}" y="${y + 42}" font-size="10.5" fill="${theme.muted}">${n.sub}</text>
  </g>`;
}

function arrowMarker(theme) {
  return `<marker id="head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="${theme.edge}"/>
    </marker>`;
}

// Arrows across the gaps between consecutive boxes in a row.
function arrows(theme, nodes, cy) {
  return nodes.slice(1).map((n, i) => {
    const from = nodes[i].x + nodes[i].w + 5;
    const to = n.x - 6;
    return `<line x1="${from}" y1="${cy}" x2="${to}" y2="${cy}" stroke="${theme.edge}" stroke-width="1.5" marker-end="url(#head)"/>`;
  }).join('\n  ');
}

// A packet that rides path `d` between fractions `start` and `end` of the cycle and is
// hidden otherwise. `fade` dims it to nothing along the way, for findings that are dropped.
function packet(theme, d, start, end, { cycle, size = 7, fill = theme.packet, fade = false }) {
  const fadeFrom = (start + (end - start) * 0.6).toFixed(3);   // solid for most of the trip, then gone
  const opacity = fade
    ? `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${start};${fadeFrom};${end};1" calcMode="linear" dur="${cycle}s" repeatCount="indefinite"/>`
    : `<animate attributeName="opacity" values="0;1;0" keyTimes="0;${start};${end}" calcMode="discrete" dur="${cycle}s" repeatCount="indefinite"/>`;
  return `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="2" fill="${fill}" opacity="0">
    <animateMotion path="${d}" keyPoints="0;0;1;1" keyTimes="0;${start};${end};1" calcMode="linear" dur="${cycle}s" repeatCount="indefinite"/>
    ${opacity}
  </rect>`;
}

// The `$ command` line across the top, with a muted note on the right.
function promptLine(theme, command, note, width) {
  return `<text x="40" y="32" font-size="14"><tspan fill="${theme.prompt}" font-weight="700">$</tspan><tspan fill="${theme.ink}" dx="8">${command}</tspan></text>
  <text x="${width - 40}" y="32" font-size="11" fill="${theme.muted}" text-anchor="end">${note}</text>`;
}

module.exports = { FONT, THEMES, NODE_H, mid, node, arrowMarker, arrows, packet, promptLine };
