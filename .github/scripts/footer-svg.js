// Renders assets/footer-dark.svg and assets/footer-light.svg, the terminal sign-off at
// the bottom of the README. Not run by CI — edit, then run from the repo root:
//   node .github/scripts/footer-svg.js
//
// It loops, unlike the cards higher up: a visitor only reaches the footer after the page
// has been open a while, so a play-once animation would already be over. One SMIL clock
// drives everything; each piece places itself with keyTimes as a fraction of CYCLE.

const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'assets';
const FONT = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

// Matches the header: one amber accent, the bright shade in dark and the deep one in light.
const THEMES = {
  dark: { ink: '#E6EDF3', muted: '#8B949E', prompt: '#F0B429', tick: '#F0B429' },
  light: { ink: '#1F2328', muted: '#59636E', prompt: '#B4690E', tick: '#B4690E' },
};

const WIDTH = 900;
const HEIGHT = 128;
const CYCLE = 10;
const CHAR = 8.4;         // advance of a 14px monospace glyph (0.6em)
const TEXT_X = 62;
const LINES = [34, 60, 86, 112];

const COMMIT = 'git commit -m "build things that matter"';
const PUSH = 'git push';

// Fractions of CYCLE.
const T = { commitTyped: 0.16, enter: 0.17, pushFrom: 0.19, pushTyped: 0.25, shipped: 0.29, idle: 0.31, fadeFrom: 0.92, gone: 0.97 };

const width = (text) => Math.ceil(text.length * CHAR);
const anim = (attr, values, keyTimes, extra = '') =>
  `<animate attributeName="${attr}" values="${values}" keyTimes="${keyTimes}" dur="${CYCLE}s" repeatCount="indefinite"${extra}/>`;
// Visible from `from` until the loop fades out.
const showFrom = (from) => anim('opacity', '0;1;0', `0;${from};${T.gone}`, ' calcMode="discrete"');

function typed(id, y, text, from, to) {
  const w = width(text);
  const values = from ? `0;0;${w};${w};0` : `0;${w};${w};0`;
  const times = from ? `0;${from};${to};${T.gone};1` : `0;${to};${T.gone};1`;
  return `<mask id="${id}" maskUnits="userSpaceOnUse">
      <rect x="${TEXT_X}" y="${y - 16}" height="22" width="0" fill="#fff">${anim('width', values, times)}</rect>
    </mask>`;
}

function cursor(theme, y, xs, keyTimes, visible) {
  return `<rect x="${xs[0]}" y="${y - 13}" width="8" height="16" fill="${theme.prompt}" opacity="0">
      ${anim('x', xs.join(';'), keyTimes)}
      ${anim('opacity', '0;1;0', visible, ' calcMode="discrete"')}
    </rect>`;
}

function svg(theme) {
  const [l1, l2, l3, l4] = LINES;
  const commitEnd = TEXT_X + width(COMMIT) + 2;
  const pushEnd = TEXT_X + width(PUSH) + 2;
  const prompt = (y) => `<text x="42" y="${y}" fill="${theme.prompt}" font-weight="700">$</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="build things that matter — ship code that scales">
  <title>build things that matter — ship code that scales</title>
  <style>text { font-family: ${FONT}; font-size: 14px; }</style>
  <defs>
    ${typed('commit', l1, COMMIT, 0, T.commitTyped)}
    ${typed('push', l2, PUSH, T.pushFrom, T.pushTyped)}
  </defs>

  <g>
    ${anim('opacity', '1;1;0;0', `0;${T.fadeFrom};${T.gone};1`)}

    ${prompt(l1)}
    <g mask="url(#commit)"><text x="${TEXT_X}" y="${l1}" fill="${theme.ink}">${COMMIT.replace(/"/g, '&quot;')}</text></g>
    ${cursor(theme, l1, [TEXT_X, commitEnd, commitEnd], `0;${T.commitTyped};1`, `0;0;${T.enter}`)}

    <g opacity="0">${showFrom(T.enter)}
      ${prompt(l2)}
    </g>
    <g mask="url(#push)"><text x="${TEXT_X}" y="${l2}" fill="${theme.ink}">${PUSH}</text></g>
    ${cursor(theme, l2, [TEXT_X, TEXT_X, pushEnd, pushEnd], `0;${T.pushFrom};${T.pushTyped};1`, `0;${T.enter};${T.shipped}`)}

    <g opacity="0">${showFrom(T.shipped)}
      <text x="${TEXT_X}" y="${l3}" fill="${theme.muted}"><tspan fill="${theme.tick}" font-weight="700">✓</tspan> shipped — code that scales</text>
    </g>

    <g opacity="0">${showFrom(T.idle)}
      ${prompt(l4)}
      <rect x="${TEXT_X}" y="${l4 - 13}" width="8" height="16" fill="${theme.prompt}">
        <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="1.1s" repeatCount="indefinite"/>
      </rect>
    </g>
  </g>
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(out, `footer-${name}.svg`), svg(theme));
}
