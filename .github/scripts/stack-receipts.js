// Renders the "Stack, with receipts" section: every technology claimed links to a repo
// that uses it. Writes one SVG per row per theme into assets/stack/, plus a header and
// a totals footer, then rewrites the README between the STACK markers. Not run by CI —
// edit RECEIPTS or PENDING, then run from the repo root:
//   node .github/scripts/stack-receipts.js
//
// Each row is its own image so it can sit inside its own link; GitHub can't link part of
// an image. Rows are stacked in the README and their delays step down the list, so they
// print in like a till receipt as the images load together.

const fs = require('fs');
const path = require('path');
const { FONT, THEMES } = require('./svg-kit');

const USER = 'MohitSAGAR11';
const OUT_DIR = 'assets/stack';
const RAW = `https://raw.githubusercontent.com/${USER}/${USER}/main/${OUT_DIR}`;
const REPO = (name) => `https://github.com/${USER}/${name}`;

const RECEIPTS = [
  { tech: 'Java · concurrency', note: 'thread-safe distributed cache engine', label: 'Distributed_Cache', url: REPO('Distributed_Cache') },
  { tech: 'Java · design patterns', note: 'algorithm-agnostic rate-limiting proxy', label: 'Rate_Limiter', url: REPO('Rate_Limiter') },
  { tech: 'Spring Boot · MongoDB · JWT', note: 'ride-sharing API with role-based auth', label: 'Uber', url: REPO('Uber') },
  { tech: 'Go', note: 'HTTP/1.1 server from raw TCP, no net/http', label: 'http11-calculator', url: REPO('http11-calculator') },
  { tech: 'TypeScript · GitHub Actions', note: 'AI reviewer that tries to refute itself', label: 'PRism', url: REPO('PRism') },
  { tech: 'Redis · Kafka · PostgreSQL', note: 'consistent-hashing cache, async writes, Docker', label: 'typeahead-system', url: REPO('typeahead-system') },
  { tech: 'RAG · LangChain · Pinecone', note: 'query expansion, LLM rerank, grounded answers', label: 'Notebook-LM', url: REPO('Notebook-LM') },
  { tech: 'Python · vector search', note: 'HNSW worked out from first principles', label: 'HNSW', url: REPO('Hierarchical-Navigable-Small-World-HSNW-') },
  { tech: 'Playwright · LLM agents', note: 'browser agent that fills forms on its own', label: 'website-automation-agent', url: REPO('website-automation-agent') },
  { tech: 'Kubernetes · Helm · Argo CD · Prometheus', note: 'GitOps deploys and alert rules', label: 'devops/monitoring', url: `${REPO('devops-assignment')}/tree/main/Monitorting_Observability_GitOps` },
  { tech: 'Terraform · AWS', note: 'VPC, subnets and security groups as code', label: 'devops/terraform', url: `${REPO('devops-assignment')}/tree/main/Cloud_and_Terraform_in_Action` },
];

// Claimed elsewhere on the profile but with no public repo behind them yet.
const PENDING = ['Grafana'];

const WIDTH = 900;
const ROW_H = 46;
const CHAR = 8.1;         // advance of a 13.5px monospace glyph (0.6em)
const TECH_X = 62;
const LABEL_RIGHT = 832;
const FIRST = 0.35;       // seconds before the first row prints
const STEP = 0.14;        // stagger between rows

const slug = (r) => r.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
    text { font-family: ${FONT}; }
    .in  { opacity: 0; animation: in .4s cubic-bezier(.2,.7,.2,1) both; }
    .pop { opacity: 0; animation: pop .3s cubic-bezier(.2,.7,.2,1) both; transform-box: fill-box; transform-origin: center; }
    @keyframes in  { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
    @keyframes pop { from { opacity: 0; transform: scale(.3); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .in, .pop { animation: none; opacity: 1; } }`;

const frame = (height, label, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-label="${escape(label)}">
  <title>${escape(label)}</title>
  <style>${STYLE}
  </style>
  ${body}
</svg>
`;

// A dotted leader that wipes in left to right, like a receipt's dot fill.
function leader(theme, id, x1, x2, y, begin) {
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse"><rect x="${x1}" y="${y - 4}" width="0" height="8" fill="#fff">
    <animate attributeName="width" from="0" to="${x2 - x1}" begin="${begin}s" dur="0.5s" fill="freeze"/>
  </rect></mask></defs>
  <line mask="url(#${id})" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${theme.muted}" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 7" opacity="0.7"/>`;
}

function row(theme, r, i) {
  const t = FIRST + i * STEP;
  const labelW = r.label.length * CHAR;
  const from = TECH_X + r.tech.length * CHAR + 14;
  const to = LABEL_RIGHT - labelW - 14;
  const at = (dt) => `style="animation-delay:${(t + dt).toFixed(2)}s"`;
  return frame(ROW_H, `${r.tech} — ${r.label}: ${r.note}`, `
  <text class="pop" ${at(0.7)} x="40" y="21" font-size="13.5" font-weight="700" fill="${theme.packet}">✓</text>
  <g class="in" ${at(0)}>
    <text x="${TECH_X}" y="21" font-size="13.5" font-weight="700" fill="${theme.ink}">${escape(r.tech)}</text>
    <text x="${TECH_X}" y="38" font-size="11" fill="${theme.muted}">${escape(r.note)}</text>
  </g>
  ${leader(theme, 'dots', from, to, 17, t + 0.15)}
  <g class="in" ${at(0.55)}>
    <text x="${LABEL_RIGHT}" y="21" font-size="13.5" font-weight="700" text-anchor="end" fill="${theme.packet}">${escape(r.label)}</text>
    <text x="${LABEL_RIGHT + 8}" y="21" font-size="13.5" fill="${theme.muted}">↗</text>
  </g>`);
}

function header(theme) {
  const cmd = 'grep -rl --receipts stack ~/repos';
  return frame(56, 'Stack, with receipts: every claim links to code', `
  <defs><mask id="typed" maskUnits="userSpaceOnUse"><rect x="62" y="12" width="0" height="26" fill="#fff">
    <animate attributeName="width" from="0" to="${Math.ceil(cmd.length * 8.4)}" begin="0.05s" dur="0.6s" fill="freeze"/>
  </rect></mask></defs>
  <text x="40" y="30" font-size="14" font-weight="700" fill="${theme.prompt}">$</text>
  <g mask="url(#typed)"><text x="62" y="30" font-size="14" fill="${theme.ink}">${cmd}</text></g>
  <text x="${WIDTH - 40}" y="30" font-size="11" text-anchor="end" fill="${theme.muted}">every claim links to code</text>
  <line x1="40" y1="48" x2="${WIDTH - 40}" y2="48" stroke="${theme.edge}" stroke-width="1.5" stroke-dasharray="6 5"/>`);
}

function footer(theme) {
  const t = (FIRST + RECEIPTS.length * STEP + 0.6).toFixed(2);
  const n = RECEIPTS.length;
  return frame(66, `Total: ${n} claims, ${n} receipts. Pending, no public repo yet: ${PENDING.join(', ')}`, `
  <line x1="40" y1="8" x2="${WIDTH - 40}" y2="8" stroke="${theme.edge}" stroke-width="1.5" stroke-dasharray="6 5"/>
  <g class="in" style="animation-delay:${t}s">
    <text x="40" y="32" font-size="13.5" font-weight="700" fill="${theme.ink}">TOTAL</text>
    <text x="${WIDTH - 40}" y="32" font-size="13.5" text-anchor="end" fill="${theme.muted}"><tspan fill="${theme.packet}" font-weight="700">${n}</tspan> claims · <tspan fill="${theme.packet}" font-weight="700">${n}</tspan> receipts</text>
    <text x="40" y="54" font-size="11" fill="${theme.muted}">pending · ${PENDING.join(' · ')} — no public repo yet</text>
  </g>`);
}

const picture = (name, alt) => `<picture>
    <source media="(prefers-color-scheme: dark)"  srcset="${RAW}/${name}-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="${RAW}/${name}-light.svg">
    <img width="900" alt="${escape(alt)}" src="${RAW}/${name}-dark.svg">
  </picture>`;

function readmeBlock() {
  const rows = RECEIPTS.map((r) =>
    `  <a href="${r.url}">${picture(slug(r), `${r.tech} — ${r.label}: ${r.note}`).replace(/\n/g, '\n  ')}</a><br>`);
  const techs = [...new Set(RECEIPTS.flatMap((r) => r.tech.split(' · ')))];
  return [
    '<!-- STACK:START — generated by .github/scripts/stack-receipts.js; edit there, not here -->',
    '<p align="center">',
    `  ${picture('header', 'Stack, with receipts: every claim links to code')}<br>`,
    ...rows,
    `  ${picture('footer', `${RECEIPTS.length} claims, ${RECEIPTS.length} receipts. Pending: ${PENDING.join(', ')}`)}`,
    '</p>',
    '',
    `<sub>${techs.join(' · ')}</sub>`,
    '<!-- STACK:END -->',
  ].join('\n');
}

function writeReadme() {
  const readme = fs.readFileSync('README.md', 'utf8');
  const pattern = /<!-- STACK:START[\s\S]*?<!-- STACK:END -->/;
  if (!pattern.test(readme)) throw new Error('STACK markers not found in README.md');
  fs.writeFileSync('README.md', readme.replace(pattern, () => readmeBlock()));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(OUT_DIR, `header-${name}.svg`), header(theme));
  fs.writeFileSync(path.join(OUT_DIR, `footer-${name}.svg`), footer(theme));
  RECEIPTS.forEach((r, i) => fs.writeFileSync(path.join(OUT_DIR, `${slug(r)}-${name}.svg`), row(theme, r, i)));
}
writeReadme();
