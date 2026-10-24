// Renders assets/title-dark.svg and assets/title-light.svg: an anime title-card header.
// Focus lines flicker around the frame, the name slams in with an impact flash and a
// shockwave, then a slanted ribbon cycles through roles with a slash cut between each.
// Not run by CI — edit ROLES or the palette, then run from the repo root:
//   node .github/scripts/header-svg.js
// and bump ?v= on the header URLs in README.md (GitHub's image proxy caches hard).
//
// The slam, flash and ribbon entrance play once (CSS); the focus lines and the role
// cycle loop forever (SMIL), with the cycle starting once the ribbon is in.

const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'assets';

const ROLES = ['SOFTWARE DEVELOPER', 'OPEN SOURCE CONTRIBUTOR', 'BACKEND ENGINEER', 'AI / ML ENGINEER'];
const NAME = 'MOHIT SAGAR';

// Dark is all raspberry. Light pairs violet (shadow, corners) with a raspberry ribbon,
// as the old header did.
const THEMES = {
  dark: { ink: '#E6EDF3', lines: '#8B949E', shadow: '#FF6B9A', ribbon: '#FF6B9A', ribbonText: '#0D1117', corner: '#FF6B9A', lineOpacity: 0.4, flash: '#FFFFFF', slash: '#FFFFFF' },
  light: { ink: '#1F2328', lines: '#59636E', shadow: '#6E44C9', ribbon: '#C2185B', ribbonText: '#FFFFFF', corner: '#6E44C9', lineOpacity: 0.32, flash: '#FFFFFF', slash: '#FFE3EE' },
};

const WIDTH = 900;
const HEIGHT = 250;
const CX = 450;
const CY = 122;
const ROLE_TIME = 2.5;    // seconds each role holds
const CYCLE = ROLES.length * ROLE_TIME;
const RIBBON_IN = 0.95;   // when the ribbon has landed and the role cycle starts
const SLASH = 0.28;       // seconds for the slash to cross the ribbon

const RIBBON = { left: 214, right: 686, top: 166, bottom: 202, lean: 18 };
const SANS = "'Arial Black','Helvetica Neue',Impact,'Segoe UI',sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

// Deterministic jitter so regenerating doesn't reshuffle the lines.
function random(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

// Wedges pointing at the centre, starting just outside an ellipse around the name.
function focusLines(seed, count) {
  const rnd = random(seed);
  const wedges = [];
  for (let k = 0; k < count; k++) {
    const a = (2 * Math.PI * (k + rnd() * 0.8)) / count;
    const cos = Math.cos(a), sin = Math.sin(a);
    const inner = (1 / Math.sqrt((cos * cos) / (335 * 335) + (sin * sin) / (106 * 106))) * (1 + rnd() * 0.5);
    const outer = 760;
    const half = 1 + rnd() * 3.5;
    const tip = [CX + cos * inner, CY + sin * inner];
    const b1 = [CX + cos * outer - sin * half, CY + sin * outer + cos * half];
    const b2 = [CX + cos * outer + sin * half, CY + sin * outer - cos * half];
    wedges.push(`M${tip.map((n) => n.toFixed(1)).join(',')} L${b1.map((n) => n.toFixed(1)).join(',')} L${b2.map((n) => n.toFixed(1)).join(',')}Z`);
  }
  return wedges.join(' ');
}

// Window [from, to) of the role cycle, as keyTimes for a discrete opacity toggle.
function roleVisibility(i) {
  const from = (i * ROLE_TIME + SLASH / 2) / CYCLE;
  const to = (((i + 1) * ROLE_TIME + SLASH / 2) / CYCLE);
  if (i === ROLES.length - 1) {
    // the last role wraps past the end of the cycle into the start of the next
    return { values: '1;0;1', keyTimes: `0;${(SLASH / 2 / CYCLE).toFixed(4)};${from.toFixed(4)}` };
  }
  return { values: '0;1;0', keyTimes: `0;${from.toFixed(4)};${to.toFixed(4)}` };
}

// The slash parks off the ribbon's left edge and crosses it at every role change.
function slashMotion() {
  const off = -70, across = RIBBON.right - RIBBON.left + 70;
  const values = [], times = [];
  ROLES.forEach((_, i) => {
    const t = (i * ROLE_TIME) / CYCLE;
    const end = (i * ROLE_TIME + SLASH) / CYCLE;
    values.push(`${off} 0`, `${across} 0`, `${off} 0`);
    times.push(t, end, Math.min(end + 0.0001, 1));
  });
  values.push(`${off} 0`);
  times.push(1);
  return { values: values.join(';'), keyTimes: times.map((t) => t.toFixed(4)).join(';') };
}

function svg(theme) {
  const { left, right, top, bottom, lean } = RIBBON;
  const ribbon = `${left + lean},${top} ${right + lean},${top} ${right - lean},${bottom} ${left - lean},${bottom}`;
  const slash = slashMotion();
  const corner = (x, y, dx, dy) => `<path d="M${x},${y + dy * 22} V${y} H${x + dx * 22}" fill="none" stroke="${theme.corner}" stroke-width="2.5" stroke-linecap="square"/>`;

  const roles = ROLES.map((role, i) => {
    const v = roleVisibility(i);
    return `<text x="${CX}" y="${bottom - 11}" text-anchor="middle" font-family="${MONO}" font-size="17" font-weight="700" letter-spacing="3" fill="${theme.ribbonText}" opacity="${i === 0 ? 1 : 0}">${role}
        <animate attributeName="opacity" values="${v.values}" keyTimes="${v.keyTimes}" calcMode="discrete" dur="${CYCLE}s" begin="${RIBBON_IN}s" repeatCount="indefinite"/>
      </text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${NAME.replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase())} — ${ROLES.join(' · ')}">
  <title>Mohit Sagar — ${ROLES.join(' · ')}</title>
  <style>
    .slam  { transform-box: fill-box; transform-origin: center; animation: slam .38s cubic-bezier(.5,0,.75,0) .25s both, shake .32s linear .63s; }
    .flash { opacity: 0; animation: flash .45s ease-out .6s; }
    .ring  { opacity: 0; transform-box: fill-box; transform-origin: center; animation: ring .7s cubic-bezier(.2,.7,.2,1) .6s; }
    .ribbon { transform-box: fill-box; transform-origin: left center; animation: ribbon .3s cubic-bezier(.2,.7,.2,1) .65s both; }
    @keyframes slam  { from { opacity: 0; transform: scale(2.2) skewX(-10deg); } to { opacity: 1; transform: scale(1) skewX(-10deg); } }
    @keyframes shake { 0%,100% { transform: skewX(-10deg); } 20% { transform: translate(-5px,3px) skewX(-10deg); } 40% { transform: translate(4px,-3px) skewX(-10deg); } 60% { transform: translate(-3px,-2px) skewX(-10deg); } 80% { transform: translate(2px,2px) skewX(-10deg); } }
    @keyframes flash { 0% { opacity: .35; } 100% { opacity: 0; } }
    @keyframes ring  { 0% { opacity: .8; transform: scale(.15); } 100% { opacity: 0; transform: scale(1.6); } }
    @keyframes ribbon { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) {
      .slam { animation: none; transform: skewX(-10deg); }
      .flash, .ring { animation: none; }
      .ribbon { animation: none; }
    }
  </style>
  <defs>
    <clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}"/></clipPath>
    <clipPath id="band"><polygon points="${ribbon}"/></clipPath>
  </defs>

  <!-- focus lines: two sets, each with a few accent strokes, swapped every 0.15s
       for an on-twos flicker -->
  <g clip-path="url(#frame)">
    <g opacity="1">
      <animate attributeName="opacity" values="1;0" dur="0.3s" calcMode="discrete" repeatCount="indefinite"/>
      <path d="${focusLines(7, 64)}" fill="${theme.lines}" opacity="${theme.lineOpacity}"/>
      <path d="${focusLines(99, 12)}" fill="${theme.shadow}" opacity="0.55"/>
    </g>
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.3s" calcMode="discrete" repeatCount="indefinite"/>
      <path d="${focusLines(42, 64)}" fill="${theme.lines}" opacity="${theme.lineOpacity}"/>
      <path d="${focusLines(123, 12)}" fill="${theme.shadow}" opacity="0.55"/>
    </g>
  </g>

  ${corner(14, 14, 1, 1)}
  ${corner(WIDTH - 14, 14, -1, 1)}
  ${corner(14, HEIGHT - 14, 1, -1)}
  ${corner(WIDTH - 14, HEIGHT - 14, -1, -1)}

  <circle class="ring" cx="${CX}" cy="${CY - 18}" r="190" fill="none" stroke="${theme.shadow}" stroke-width="3"/>

  <g class="slam">
    <text x="${CX + 6}" y="${CY + 6}" text-anchor="middle" font-family="${SANS}" font-size="74" font-weight="900" letter-spacing="3" fill="${theme.shadow}">${NAME}</text>
    <text x="${CX}" y="${CY}" text-anchor="middle" font-family="${SANS}" font-size="74" font-weight="900" letter-spacing="3" fill="${theme.ink}">${NAME}</text>
  </g>

  <g class="ribbon">
    <polygon points="${ribbon}" fill="${theme.ribbon}"/>
    <g clip-path="url(#band)">
      ${roles.join('\n      ')}
      <polygon points="${left},${top} ${left + 34},${top} ${left + 4},${bottom} ${left - 30},${bottom}" fill="${theme.slash}" opacity="0.9">
        <animateTransform attributeName="transform" type="translate" values="${slash.values}" keyTimes="${slash.keyTimes}" dur="${CYCLE}s" begin="${RIBBON_IN}s" repeatCount="indefinite"/>
      </polygon>
    </g>
  </g>

  <text x="${WIDTH - 40}" y="${HEIGHT - 26}" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="2" fill="${theme.lines}">github.com/MohitSAGAR11</text>

  <rect class="flash" width="${WIDTH}" height="${HEIGHT}" fill="${theme.flash}"/>
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `title-${name}.svg`), svg(theme));
}
