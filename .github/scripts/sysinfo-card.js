// Renders assets/sysinfo-dark.svg and assets/sysinfo-light.svg, the neofetch-style card
// in the About section. Not run by CI — edit ROWS, then run from the repo root:
//   node .github/scripts/sysinfo-card.js
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || 'assets';

const FONT = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

const THEMES = {
  dark: {
    card: '#161B22', edge: '#30363D', ink: '#E6EDF3', muted: '#8B949E',
    key: '#FF6B9A', logo: '#FF6B9A', shadow: '#5C1F38', prompt: '#FF6B9A',
    swatches: ['#3A1424', '#5C1F38', '#85234B', '#B02E5F', '#E0457B', '#FF6B9A', '#FF9DBB', '#FFD6E3'],
  },
  light: {
    card: '#F6F8FA', edge: '#D0D7DE', ink: '#1F2328', muted: '#59636E',
    key: '#6E44C9', logo: '#6E44C9', shadow: '#F8BBD0', prompt: '#C2185B',
    swatches: ['#FCE4EC', '#F8BBD0', '#F48FB1', '#EC407A', '#D81B60', '#C2185B', '#AD1457', '#880E4F'],
  },
};

const ROWS = [
  ['role', 'Backend engineer · AI/ML · system design'],
  ['stack', 'Java · Python · Go · TypeScript'],
  ['backend', 'Spring Boot · Node.js · Express · microservices'],
  ['ai', 'LangChain · RAG pipelines · Milvus · OpenAI'],
  ['infra', 'Docker · Kubernetes · Prometheus · Grafana · AWS'],
  ['oss', 'Open Library · Hyperjump JSON Schema'],
  ['learning', 'LangGraph · AI agents · MCP · advanced RAG'],
  ['location', 'India'],
];

// 5×7 pixel font, M then S
const GLYPHS = [
  ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
];

const PX = 15, PITCH = 17, LOGO_X = 52, LOGO_Y = 146;
const INFO_X = 300, VALUE_X = 392, ROW_Y = 140, ROW_STEP = 21;
const T_ROWS = 1.25, ROW_GAP = 0.11;

function pixels(theme) {
  const cells = [];
  GLYPHS.forEach((glyph, g) => glyph.forEach((line, r) => [...line].forEach((bit, c) => {
    if (bit !== '1') return;
    const col = g * 6 + c;
    const x = LOGO_X + col * PITCH, y = LOGO_Y + r * PITCH;
    const delay = (0.95 + col * 0.035 + r * 0.02).toFixed(2);
    cells.push(`<g class="px" style="animation-delay:${delay}s"><rect x="${x + 3}" y="${y + 3}" width="${PX}" height="${PX}" rx="2" fill="${theme.shadow}"/><rect x="${x}" y="${y}" width="${PX}" height="${PX}" rx="2" fill="${theme.logo}"/></g>`);
  })));
  return cells.join('\n    ');
}

function rows(theme) {
  return ROWS.map(([key, value], i) => {
    const y = ROW_Y + i * ROW_STEP;
    const delay = (T_ROWS + 0.22 + i * ROW_GAP).toFixed(2);
    return `<g class="row" style="animation-delay:${delay}s"><text x="${INFO_X}" y="${y}" fill="${theme.key}" font-weight="700">${key}</text><text x="${VALUE_X}" y="${y}" fill="${theme.ink}">${value.replace(/&/g, '&amp;')}</text></g>`;
  }).join('\n    ');
}

function swatches(theme) {
  const y = ROW_Y + ROWS.length * ROW_STEP + 2;
  const delay0 = T_ROWS + 0.22 + ROWS.length * ROW_GAP + 0.1;
  return theme.swatches.map((fill, i) =>
    `<rect class="sw" style="animation-delay:${(delay0 + i * 0.05).toFixed(2)}s" x="${INFO_X + i * 26}" y="${y}" width="22" height="12" rx="2" fill="${fill}"/>`,
  ).join('\n    ');
}

function svg(theme) {
  const height = ROW_Y + ROWS.length * ROW_STEP + 40;
  const headerY = ROW_Y - 36;
  const cmd = 'neofetch --theme raspberry';
  const cmdWidth = Math.ceil(cmd.length * 8.45);
  const end = (T_ROWS + 0.22 + ROWS.length * ROW_GAP + 0.6).toFixed(2);
  const bottomY = height - 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" width="900" height="${height}" role="img" aria-label="Mohit Sagar — ${ROWS.map(([k, v]) => `${k}: ${v}`).join('; ')}">
  <title>mohit@sagar — system info</title>
  <!-- Plays once and holds. Rows, logo pixels and swatches are CSS keyframes with
       per-element delays; the typed command is a SMIL mask wipe, as in the header. -->
  <style>
    text { font-family: ${FONT}; font-size: 13.5px; }
    .px, .row, .sw, .late { opacity: 0; animation-fill-mode: both; animation-timing-function: cubic-bezier(.2,.7,.2,1); }
    .px  { animation-name: pop;   animation-duration: .35s; transform-box: fill-box; transform-origin: center; }
    .row { animation-name: slide; animation-duration: .45s; }
    .sw  { animation-name: pop;   animation-duration: .3s;  transform-box: fill-box; transform-origin: center; }
    .late { animation-name: fade; animation-duration: .3s; animation-delay: ${end}s; }
    .blink { animation: blink 1.1s steps(1) infinite; }
    @keyframes pop   { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
    @keyframes slide { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
    @keyframes fade  { to { opacity: 1; } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .px, .row, .sw, .late { animation: none; opacity: 1; }
      .blink { animation: none; }
    }
  </style>
  <defs>
    <mask id="typed" maskUnits="userSpaceOnUse">
      <rect x="44" y="40" height="26" width="0" fill="#fff">
        <animate attributeName="width" from="0" to="${cmdWidth}" begin="0.2s" dur="0.7s" fill="freeze"/>
      </rect>
    </mask>
  </defs>

  <rect x="1" y="1" width="898" height="${height - 2}" rx="12" fill="${theme.card}" stroke="${theme.edge}" stroke-width="1.5"/>
  <circle cx="24" cy="19" r="5.5" fill="${theme.prompt}"/>
  <circle cx="42" cy="19" r="5.5" fill="${theme.edge}"/>
  <circle cx="60" cy="19" r="5.5" fill="${theme.edge}"/>
  <text x="450" y="23" fill="${theme.muted}" font-size="12" text-anchor="middle">mohit@sagar: ~</text>
  <line x1="1" y1="37" x2="899" y2="37" stroke="${theme.edge}" stroke-width="1"/>

  <text x="28" y="60" fill="${theme.prompt}" font-weight="700">$</text>
  <g mask="url(#typed)"><text x="44" y="60" fill="${theme.ink}">${cmd}</text></g>

  <g>
    ${pixels(theme)}
  </g>

  <g class="row" style="animation-delay:${T_ROWS.toFixed(2)}s">
    <text x="${INFO_X}" y="${headerY}" font-weight="700"><tspan fill="${theme.key}">mohit</tspan><tspan fill="${theme.muted}">@</tspan><tspan fill="${theme.key}">sagar</tspan></text>
    <line x1="${INFO_X}" y1="${headerY + 10}" x2="${INFO_X + 92}" y2="${headerY + 10}" stroke="${theme.muted}" stroke-width="1" stroke-dasharray="3 3"/>
  </g>
  <g>
    ${rows(theme)}
  </g>
  <g>
    ${swatches(theme)}
  </g>

  <g class="late">
    <text x="28" y="${bottomY}" fill="${theme.prompt}" font-weight="700">$</text>
    <rect class="blink" x="44" y="${bottomY - 13}" width="8" height="16" fill="${theme.prompt}"/>
  </g>
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `sysinfo-${name}.svg`), svg(theme));
}
