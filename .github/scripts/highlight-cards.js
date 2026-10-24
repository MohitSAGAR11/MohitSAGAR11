// Renders the Open Source "Highlights" as animated diff cards: the bug as a `-` line,
// the fix as a `+` line, then a status stamp. One SVG per card per theme in
// assets/highlights/, and the README block between the HIGHLIGHTS markers. Not run by
// CI — edit CARDS, then run from the repo root:
//   node .github/scripts/highlight-cards.js
//
// Each card is its own image so it can link to its pull request. Lines are kept to
// 54 characters so they fit the 440px card at 12px monospace.

const fs = require('fs');
const path = require('path');
const { FONT, THEMES } = require('./svg-kit');

const USER = 'MohitSAGAR11';
const OUT_DIR = 'assets/highlights';
const RAW = `https://raw.githubusercontent.com/${USER}/${USER}/main/${OUT_DIR}`;
// Bump when restyling: browsers and GitHub's image proxy cache these URLs.
const BUST = 'v=amber';
const OL = 'https://github.com/internetarchive/openlibrary/pull';

const CARDS = [
  {
    repo: 'openlibrary', number: 14024, url: `${OL}/14024`, status: 'merged',
    title: 'match authors regardless of name order',
    before: '"Sagar, Mohit" ≠ "Mohit Sagar" → duplicate edition',
    after: 'compare both name orders → existing edition reused',
  },
  {
    repo: 'openlibrary', number: 13888, url: `${OL}/13888`, status: 'merged',
    title: 'keep the MARC $c title out of author names',
    before: '"pseud." glued to the name → no author match',
    after: '$c kept separate → matches the existing author',
  },
  {
    repo: 'json-schema', number: 134, url: 'https://github.com/hyperjump-io/json-schema/pull/134', status: 'merged',
    title: 'reject an invalid schema every time',
    before: '1st validate throws, 2nd silently passes',
    after: 'invalid schema rejected on every validation',
  },
  {
    repo: 'openlibrary', number: 13671, url: `${OL}/13671`, status: 'merged',
    title: 'My Book Notes modal on the design system',
    before: 'jQuery colorbox; a failed save vanishes silently',
    after: 'rebuilt on <ol-dialog>; failed saves show an error',
  },
];

const WIDTH = 440;
const HEIGHT = 156;
const CHAR = 7.2;         // advance of a 12px monospace glyph (0.6em)
const STEP = 0.35;        // stagger between cards

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const name = (c) => `${c.repo}-${c.number}`;

function wipe(id, x, y, text, begin) {
  return `<mask id="${id}" maskUnits="userSpaceOnUse"><rect x="${x}" y="${y - 13}" width="0" height="18" fill="#fff">
      <animate attributeName="width" from="0" to="${Math.ceil(text.length * CHAR) + 4}" begin="${begin}s" dur="0.7s" fill="freeze"/>
    </rect></mask>`;
}

function card(theme, c, i) {
  const t = 0.3 + i * STEP;
  const stamp = `${c.status} ✓`;
  const stampW = stamp.length * 6.6 + 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escape(`${c.repo} #${c.number}, ${c.status}: ${c.title}. Before: ${c.before}. After: ${c.after}.`)}">
  <title>${escape(`${c.repo} #${c.number} — ${c.title}`)}</title>
  <style>
    text { font-family: ${FONT}; }
    .pop { opacity: 0; animation: pop .3s cubic-bezier(.2,.7,.2,1) ${(t + 1.5).toFixed(2)}s both; transform-box: fill-box; transform-origin: center; }
    @keyframes pop { from { opacity: 0; transform: scale(.4) rotate(-8deg); } to { opacity: 1; transform: rotate(-3deg); } }
    @media (prefers-reduced-motion: reduce) { .pop { animation: none; opacity: 1; transform: rotate(-3deg); } }
  </style>
  <defs>
    ${wipe('before', 44, 96, c.before, t + 0.1)}
    ${wipe('after', 44, 124, c.after, t + 0.8)}
  </defs>

  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="10" fill="${theme.card}" stroke="${theme.edge}" stroke-width="1.5"/>
  <text x="20" y="28" font-size="12.5"><tspan fill="${theme.muted}">${c.repo}</tspan><tspan fill="${theme.packet}" font-weight="700" dx="6">#${c.number}</tspan></text>
  <text x="20" y="52" font-size="12.5" font-weight="700" fill="${theme.ink}">${escape(c.title)}</text>

  <rect x="12" y="72" width="${WIDTH - 24}" height="66" rx="6" fill="${theme.edge}" fill-opacity="0.35"/>
  <text x="26" y="96" font-size="12" font-weight="700" fill="${theme.muted}">-</text>
  <g mask="url(#before)"><text x="44" y="96" font-size="12" fill="${theme.muted}">${escape(c.before)}</text></g>
  <text x="26" y="124" font-size="12" font-weight="700" fill="${theme.packet}">+</text>
  <g mask="url(#after)"><text x="44" y="124" font-size="12" fill="${theme.ink}">${escape(c.after)}</text></g>

  <g class="pop">
    <rect x="${WIDTH - 20 - stampW}" y="12" width="${stampW}" height="22" rx="11" fill="none" stroke="${theme.packet}" stroke-width="1.5"/>
    <text x="${WIDTH - 20 - stampW / 2}" y="27" font-size="11" font-weight="700" text-anchor="middle" fill="${theme.packet}">${stamp}</text>
  </g>
</svg>
`;
}

const picture = (c) => `<a href="${c.url}"><picture>
    <source media="(prefers-color-scheme: dark)"  srcset="${RAW}/${name(c)}-dark.svg?${BUST}">
    <source media="(prefers-color-scheme: light)" srcset="${RAW}/${name(c)}-light.svg?${BUST}">
    <img width="410" alt="${escape(`${c.repo} #${c.number} — ${c.title}: ${c.before} → ${c.after}`)}" src="${RAW}/${name(c)}-dark.svg?${BUST}">
  </picture></a>`;

function readmeBlock() {
  return [
    '<!-- HIGHLIGHTS:START — generated by .github/scripts/highlight-cards.js; edit there, not here -->',
    '<p align="center">',
    ...CARDS.map((c, i) => `  ${picture(c).replace(/\n/g, '\n  ')}${i % 2 ? '<br>' : ''}`),
    '</p>',
    '<!-- HIGHLIGHTS:END -->',
  ].join('\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [themeName, theme] of Object.entries(THEMES)) {
  CARDS.forEach((c, i) => fs.writeFileSync(path.join(OUT_DIR, `${name(c)}-${themeName}.svg`), card(theme, c, i)));
}

const readme = fs.readFileSync('README.md', 'utf8');
const pattern = /<!-- HIGHLIGHTS:START[\s\S]*?<!-- HIGHLIGHTS:END -->/;
if (!pattern.test(readme)) throw new Error('HIGHLIGHTS markers not found in README.md');
fs.writeFileSync('README.md', readme.replace(pattern, () => readmeBlock()));
