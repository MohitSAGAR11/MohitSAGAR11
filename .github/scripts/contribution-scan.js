// Renders the contribution scan that replaced the snake: the past year's contribution
// calendar as an amber heatmap that a scanner beam re-lights column by column.
// Writes one SVG per theme. Called by .github/workflows/contribution-scan.yml.
//
// Motion is plain CSS keyframes inside the SVG — GitHub serves it through <img>, so
// there is no JS. Every column runs the same keyframes on the same cycle, offset by
// its delay, which keeps the beam and the cells in lockstep on every loop.

const fs = require('fs');

const USER = 'MohitSAGAR11';

const THEMES = {
  dark: {
    file: 'assets/contrib-dark.svg',
    ink: '#E6EDF3', muted: '#8B949E', accent: '#F0B429', flash: '#FDE7B5', wire: '#30363D',
    levels: ['#161B22', '#4A3511', '#7A5514', '#B8821D', '#F0B429'],
  },
  light: {
    file: 'assets/contrib-light.svg',
    ink: '#1F2328', muted: '#59636E', accent: '#B4690E', flash: '#F5A623', wire: '#D0D7DE',
    levels: ['#EFF2F5', '#FBE3B0', '#F2C066', '#D4921F', '#B4690E'],
  },
};

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const WIDTH = 900;
const HEIGHT = 214;
const CELL = 11;
const PITCH = 14;           // cell + 3px gap
const GRID_Y = 70;
const CYCLE = 12;           // seconds per scan loop
const SWEEP = 4;            // seconds for the beam to cross the grid
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FONT = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date weekday contributionCount contributionLevel } }
        }
      }
    }
  }`;

async function fetchCalendar(github) {
  const { user } = await github.graphql(QUERY, { login: USER });
  return user.contributionsCollection.contributionCalendar;
}

function summarise(days) {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.contributionCount ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // Today can still be empty when the job runs; that doesn't break the streak yet.
  const counted = days.at(-1).contributionCount ? days : days.slice(0, -1);
  let current = 0;
  for (let i = counted.length - 1; i >= 0 && counted[i].contributionCount; i--) current++;

  const best = days.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a));
  return { longest, current, best };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function renderStyle(theme, cols, gridX) {
  const sweepEnd = ((SWEEP / CYCLE) * 100).toFixed(2);
  const beamFrom = gridX + CELL / 2;
  const beamTo = gridX + cols * PITCH + CELL / 2;

  // Each level flashes as the beam hits, settles to its colour, holds, then drops
  // back to an empty wireframe a little before the beam comes round again.
  const levels = theme.levels.map((fill, k) => {
    const hit = k ? theme.flash : fill;
    return `
    @keyframes k${k} {
      0%       { fill: ${hit}; stroke: ${hit}; }
      8%, 72%  { fill: ${fill}; stroke: ${fill}; }
      80%, 100% { fill: transparent; stroke: ${theme.wire}; }
    }
    .k${k} { fill: transparent; stroke: ${theme.wire}; animation: k${k} ${CYCLE}s ease-out infinite; }`;
  });

  const delays = Array.from({ length: cols }, (_, c) =>
    `.c${c} { animation-delay: ${((c * SWEEP) / cols).toFixed(3)}s; }`);

  const still = theme.levels.map((fill, k) => `.k${k} { fill: ${fill}; stroke: ${fill}; animation: none; }`);

  return `
  <style>
    text { font-family: ${FONT}; }
    rect.d { stroke-width: 1; }
    @keyframes beam {
      0%          { transform: translateX(${beamFrom}px); opacity: 1; }
      ${sweepEnd}% { transform: translateX(${beamTo}px); opacity: 1; }
      ${(Number(sweepEnd) + 1).toFixed(2)}%, 100% { transform: translateX(${beamTo}px); opacity: 0; }
    }
    .beam { animation: beam ${CYCLE}s linear infinite; }
    ${levels.join('\n')}
    ${delays.join('\n    ')}
    @media (prefers-reduced-motion: reduce) {
      .beam { display: none; }
      ${still.join('\n      ')}
    }
  </style>`;
}

function renderGrid(weeks, gridX) {
  const cells = weeks.flatMap((week, c) =>
    week.contributionDays.map((day) => {
      const x = gridX + c * PITCH + 0.5;
      const y = GRID_Y + day.weekday * PITCH + 0.5;
      const k = LEVEL[day.contributionLevel] ?? 0;
      return `<rect class="d k${k} c${c}" x="${x}" y="${y}" width="${CELL - 1}" height="${CELL - 1}" rx="2"><title>${day.date}: ${plural(day.contributionCount, 'contribution')}</title></rect>`;
    }));
  return cells.join('\n    ');
}

function renderMonths(weeks, gridX, theme) {
  const labels = [];
  let lastMonth = -1;
  let lastCol = -Infinity;
  weeks.forEach((week, c) => {
    const month = Number(week.contributionDays[0].date.slice(5, 7)) - 1;
    if (month === lastMonth) return;
    lastMonth = month;
    if (c - lastCol < 3) return;   // a partial first week would crowd the next label
    lastCol = c;
    labels.push(`<text x="${gridX + c * PITCH}" y="${GRID_Y - 9}" fill="${theme.muted}" font-size="10">${MONTHS[month]}</text>`);
  });
  return labels.join('\n  ');
}

function renderLegend(theme, rightX, y) {
  const swatches = theme.levels.map((fill, k) => {
    const x = rightX - 34 - (theme.levels.length - k) * PITCH;
    return `<rect x="${x}" y="${y - 9}" width="${CELL - 1}" height="${CELL - 1}" rx="2" fill="${fill}"/>`;
  });
  const lessX = rightX - 40 - theme.levels.length * PITCH;
  return [
    `<text x="${lessX}" y="${y}" fill="${theme.muted}" font-size="10" text-anchor="end">less</text>`,
    ...swatches,
    `<text x="${rightX}" y="${y}" fill="${theme.muted}" font-size="10" text-anchor="end">more</text>`,
  ].join('\n  ');
}

function renderSvg(calendar, theme) {
  const { weeks, totalContributions } = calendar;
  const days = weeks.flatMap((week) => week.contributionDays);
  const { longest, current, best } = summarise(days);

  const cols = weeks.length;
  const gridWidth = cols * PITCH - (PITCH - CELL);
  const gridX = Math.round((WIDTH - gridWidth) / 2 + 14);   // +14 leaves room for the day labels
  const rightX = gridX + gridWidth;
  const gridBottom = GRID_Y + 7 * PITCH - (PITCH - CELL);
  const footerY = gridBottom + 30;
  const total = totalContributions.toLocaleString('en-US');

  const dayLabels = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([row, name]) =>
    `<text x="${gridX - 8}" y="${GRID_Y + row * PITCH + 9}" fill="${theme.muted}" font-size="10" text-anchor="end">${name}</text>`);

  const footer = [
    `longest streak <tspan fill="${theme.ink}">${plural(longest, 'day')}</tspan>`,
    `current <tspan fill="${theme.ink}">${plural(current, 'day')}</tspan>`,
    `best day <tspan fill="${theme.ink}">${best.date}</tspan> (${best.contributionCount})`,
  ].join('  ·  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${total} contributions in the last year. Longest streak ${plural(longest, 'day')}.">
  <title>${USER} — ${total} contributions in the last year</title>
  <defs>
    <linearGradient id="beamGlow" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${renderStyle(theme, cols, gridX)}

  <text x="${gridX}" y="30" font-size="14"><tspan fill="${theme.accent}" font-weight="700">$</tspan><tspan fill="${theme.ink}" dx="8">git log --author=${USER} --since="1 year ago" | heatmap</tspan></text>
  <text x="${rightX}" y="30" font-size="14" text-anchor="end" fill="${theme.muted}"><tspan fill="${theme.accent}" font-weight="700">${total}</tspan> contributions</text>

  ${renderMonths(weeks, gridX, theme)}
  ${dayLabels.join('\n  ')}

  <g>
    ${renderGrid(weeks, gridX)}
  </g>

  <g class="beam">
    <rect x="-14" y="${GRID_Y - 6}" width="28" height="${gridBottom - GRID_Y + 12}" fill="url(#beamGlow)"/>
    <rect x="-1" y="${GRID_Y - 6}" width="2" height="${gridBottom - GRID_Y + 12}" rx="1" fill="${theme.accent}"/>
  </g>

  <text x="${gridX}" y="${footerY}" font-size="11" fill="${theme.muted}">${footer}</text>
  ${renderLegend(theme, rightX, footerY)}
</svg>
`;
}

module.exports = async ({ github, core }) => {
  const calendar = await fetchCalendar(github);
  if (!calendar.weeks.length) {
    core.setFailed('Contribution calendar came back empty.');
    return;
  }

  for (const theme of Object.values(THEMES)) {
    fs.writeFileSync(theme.file, renderSvg(calendar, theme));
  }
  core.info(`Rendered ${calendar.totalContributions} contributions across ${calendar.weeks.length} weeks.`);
};
