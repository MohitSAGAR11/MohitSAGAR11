// Rewrites the two auto-generated blocks in the README's Open Source section:
//   OSS-FIXED — pull requests that close an issue USER reported themselves, as
//               animated rows in assets/oss-fixed/ (see oss-fixed-rows.js)
//   OSS-LIST  — every upstream pull request, grouped by repository
// It also redraws assets/oss-timeline-{dark,light}.svg (see oss-timeline.js).
// All of it comes from one GraphQL search. Called by .github/workflows/open-source.yml.

const fs = require('fs');
const { THEMES } = require('./svg-kit');
const { renderTimeline } = require('./oss-timeline');
const { renderFixedRow } = require('./oss-fixed-rows');

const USER = 'MohitSAGAR11';
const RAW = `https://raw.githubusercontent.com/${USER}/${USER}/main`;
const FIXED_DIR = 'assets/oss-fixed';
// Bump when restyling: browsers and GitHub's image proxy cache these URLs.
const BUST = 'v=amber';

// Tutorials and coursework rather than upstream contributions.
const EXCLUDED_REPOS = [
  'firstcontributions/first-contributions',
  'Nency-Ravaliya/devops-heros',
];

// Closed-unmerged PRs and drafts are left out; only these states are shown.
const STATUS = { MERGED: 'merged', OPEN: 'in review' };

const SEARCH = [
  'is:pr',
  `author:${USER}`,
  `-user:${USER}`,
  ...EXCLUDED_REPOS.map((repo) => `-repo:${repo}`),
].join(' ');

// 100 is the GraphQL page cap; paginate with `after:` once there are more.
const QUERY = `
  query($q: String!) {
    search(query: $q, type: ISSUE, first: 100) {
      nodes {
        ... on PullRequest {
          number title url state isDraft createdAt mergedAt
          repository { nameWithOwner url }
          closingIssuesReferences(first: 5) {
            nodes { number title url author { login } }
          }
        }
      }
    }
  }`;

// Titles are user-written: keep them from opening HTML tags or splitting table cells.
const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');

// Same, for an HTML attribute value, where `|` is harmless and `"` would end the value.
const attr = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shortName = (nameWithOwner) => nameWithOwner.split('/')[1];

async function fetchPullRequests(github) {
  const { search } = await github.graphql(QUERY, { q: SEARCH });
  return search.nodes
    .filter((pr) => STATUS[pr.state] && !pr.isDraft)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Pull requests that close an issue USER opened, one entry per issue.
const selfReportedFixes = (prs) => prs.flatMap((pr) =>
  pr.closingIssuesReferences.nodes
    .filter((issue) => issue.author?.login === USER)
    .map((issue) => ({ repo: shortName(pr.repository.nameWithOwner), issue, pr, merged: pr.state === 'MERGED' })));

const fixedFile = (fix, theme) => `${FIXED_DIR}/${fix.repo}-${fix.issue.number}-${theme}.svg`;

// Writes one animated row per fix and returns the README block that stacks them.
function renderFixed(prs) {
  const fixes = selfReportedFixes(prs);
  if (!fixes.length) return '_No self-reported fixes yet._';

  fs.mkdirSync(FIXED_DIR, { recursive: true });
  fixes.forEach((fix, i) => {
    for (const [name, theme] of Object.entries(THEMES)) {
      fs.writeFileSync(fixedFile(fix, name), renderFixedRow(fix, theme, i));
    }
  });

  const rows = fixes.map((fix) => {
    const alt = attr(`${fix.repo}#${fix.issue.number} ${fix.issue.title} → #${fix.pr.number} (${STATUS[fix.pr.state]})`);
    return `  <a href="${fix.pr.url}"><picture>
    <source media="(prefers-color-scheme: dark)"  srcset="${RAW}/${fixedFile(fix, 'dark')}?${BUST}">
    <source media="(prefers-color-scheme: light)" srcset="${RAW}/${fixedFile(fix, 'light')}?${BUST}">
    <img width="900" alt="${alt}" src="${RAW}/${fixedFile(fix, 'dark')}?${BUST}">
  </picture></a><br>`;
  });
  return ['<p align="center">', ...rows, '</p>'].join('\n');
}

function renderList(prs) {
  const byRepo = new Map();
  for (const pr of prs) {
    const key = pr.repository.nameWithOwner;
    byRepo.set(key, [...(byRepo.get(key) || []), pr]);
  }

  const merged = (list) => list.filter((pr) => pr.state === 'MERGED').length;
  const repos = [...byRepo.entries()].sort(
    ([, a], [, b]) => merged(b) - merged(a) || b.length - a.length,
  );

  if (!repos.length) return '- _No upstream pull requests yet._';

  return repos
    .map(([name, list]) => {
      const counts = [
        merged(list) && `${merged(list)} merged`,
        list.length - merged(list) && `${list.length - merged(list)} in review`,
      ].filter(Boolean).join(' · ');
      const header = `- **[${name}](${list[0].repository.url})** — ${counts}`;
      const items = list.map(
        (pr) => `  - \`${STATUS[pr.state]}\` [#${pr.number}](${pr.url}) ${escape(pr.title)}`,
      );
      return [header, ...items].join('\n');
    })
    .join('\n');
}

function replaceBlock(readme, name, body) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(readme)) throw new Error(`${name} markers not found in README.md`);
  // function replacer: keeps any $-sequence in a title from being read as a backreference
  return readme.replace(pattern, () => `${start}\n${body}\n${end}`);
}

module.exports = async ({ github, core }) => {
  const prs = await fetchPullRequests(github);
  const readme = fs.readFileSync('README.md', 'utf8');

  let updated;
  try {
    updated = replaceBlock(readme, 'OSS-FIXED', renderFixed(prs));
    updated = replaceBlock(updated, 'OSS-LIST', renderList(prs));
  } catch (error) {
    core.setFailed(error.message);
    return;
  }

  fs.writeFileSync('README.md', updated);
  for (const [name, theme] of Object.entries(THEMES)) {
    fs.writeFileSync(`assets/oss-timeline-${name}.svg`, renderTimeline(prs, theme));
  }
  core.info(`Wrote ${prs.length} upstream pull request(s).`);
};
