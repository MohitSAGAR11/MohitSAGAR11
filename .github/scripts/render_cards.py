#!/usr/bin/env python3
"""Render the profile README's animated SVG cards into cards/.

    python .github/scripts/render_cards.py            # animated cards  -> cards/
    STATIC=1 python .github/scripts/render_cards.py   # final frame only -> cards-static/

Both runs also write preview.html next to the cards: open it in a browser to see the
stack as the README lays it out (STATIC=1 is the one to screenshot).

GitHub shows these through <img>, which allows no scripts and no external requests. So
every card is self-contained: one inline <style> block of CSS keyframes, a few SMIL
<animate> elements, and its fonts subset with pyftsubset to the glyphs it uses and
embedded as base64 WOFF. Each card's delays continue from the one above it, so the page
plays top to bottom on load. Under prefers-reduced-motion every animation is switched off
and the card shows its final frame.

Colours and type follow mohitsagar11.github.io (see DESIGN.md in that repo): warm black,
bone text, one terminal-amber accent; Archivo Black at 62% width for display, Archivo
for body, JetBrains Mono for labels. Font sources and the portrait live in .github/cards/.

Contribution data comes from data/contributions.json, written daily by
.github/scripts/contribution-scan.js. Only dependency: fonttools.
"""

from __future__ import annotations

import base64
import html
import json
import os
import random
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / ".github" / "cards"
DATA_FILE = ROOT / "data" / "contributions.json"
STATIC = os.environ.get("STATIC") == "1"
OUT = ROOT / ("cards-static" if STATIC else "cards")

# ── Palette: src/app/globals.css on the website ──────────────────────────────
CANVAS = "#0f0e0c"
SURFACE = "#1a1916"
LINE = "#2a2824"
BONE = "#ece8df"
MUTED = "#8f897e"
AMBER = "#ffb000"
MERGED = "#7ee787"

EXPO = "cubic-bezier(.16,1,.3,1)"   # GSAP expo.out, the site's reveal ease
PAD = 48
WIDE = 900                          # full-width cards; tiles are 32.5% of it
MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")

# ── Content ──────────────────────────────────────────────────────────────────
SITE = "https://mohitsagar11.github.io/"
PROFILE = {
    "name": "Mohit Sagar",
    "label": "Backend & AI engineer — Bangalore, India",
    "line": (("I find the bug,", BONE), ("file it,", MUTED), ("fix it.", AMBER)),
    "status": "Open to backend & AI internships",
    "portrait": SRC / "portrait.jpg",   # delete the file (or set None) to drop it
}


@dataclass(frozen=True)
class Link:
    slug: str
    kind: str
    title: str
    value: str
    href: str


LINKS = (
    Link("site", "Website", "Portfolio", "mohitsagar11.github.io", SITE),
    Link("linkedin", "Network", "LinkedIn", "in/mohit-sagar-066834328",
         "https://www.linkedin.com/in/mohit-sagar-066834328/"),
    Link("email", "Mail", "Email", "mohitsagar378@gmail.com", "mailto:mohitsagar378@gmail.com"),
)


@dataclass(frozen=True)
class Repo:
    slug: str
    name: str
    kicker: str
    summary: str
    tags: tuple[str, ...]
    shell: str
    preview: tuple[str, ...]
    href: str
    live: str | None = None


REPOS = (
    Repo(
        "notebook-lm", "Notebook-LM", "RAG pipeline · chat with your files",
        "Upload a document and chat with it. Each question is expanded into three, searched in "
        "parallel, reranked by an LLM, and answered only from the top five chunks.",
        ("JavaScript", "LangChain", "Pinecone", "RAG", "Embeddings"),
        "~/notebook-lm",
        ("upload → chunk 800 / overlap 150", "embed all-MiniLM-L6-v2 → Pinecone",
         "1 question → 3 queries", "top 5 each → LLM rerank", "✓ answers from the top 5 chunks"),
        "https://github.com/MohitSAGAR11/Notebook-LM", "https://rag-notebook-lm.netlify.app/",
    ),
    Repo(
        "prism", "PRism", "AI code review · GitHub Action",
        "A precision-first AI code reviewer, run as a GitHub Action or CLI. One model proposes "
        "defects, a second tries to refute each, and only survivors are posted inline. PR code "
        "is treated as untrusted and never executed.",
        ("TypeScript", "GitHub Actions", "OpenRouter", "Octokit", "Zod", "Vitest"),
        "~/prism",
        ("on: pull_request", "propose → refute → gate", "PR head code never executed",
         "field test: 3/3 on the right line", "✓ 156 Vitest tests"),
        "https://github.com/MohitSAGAR11/PRism", "https://prism-demo-0cud.onrender.com",
    ),
    Repo(
        "codefang", "CodeFang", "Coding agent · terminal",
        "A terminal coding agent that can't touch the disk without consent. Edits are staged in "
        "memory, and you approve them from a unified diff in the terminal or over Telegram. Every "
        "path is jailed to the workspace, with .env, .git and node_modules blocked.",
        ("TypeScript", "Bun", "Vercel AI SDK", "Telegraf", "Zod"),
        "~/codefang",
        ("$ codefang", "edits staged in memory, not on disk", "review the unified diff",
         "? approve changes (y/N)", "✓ 163 Bun tests"),
        "https://github.com/MohitSAGAR11/CodeFang", "https://codefang-playground.onrender.com",
    ),
    Repo(
        "recruitor-ai", "Recruitor-AI", "AI screening · full stack",
        "An end-to-end AI screening pipeline: paste a job description, upload up to 50 CVs, and "
        "watch candidates scored across five dimensions and ranked live. It audits the shortlist "
        "for bias and writes 12 tailored interview questions per candidate.",
        ("JavaScript", "Node.js", "Express", "React", "PostgreSQL", "SSE"),
        "~/recruitor-ai",
        ("POST /api/jd/parse", "50 CVs → pdf-parse + mammoth", "score × 5 dimensions → SSE stream",
         "bias audit on the shortlist", "✓ 12 interview questions each"),
        "https://github.com/MohitSAGAR11/Recruitor-AI", "https://frontend-rho-teal-32.vercel.app",
    ),
)

# Seconds after load at which each card starts, in page order. The repo cards sit
# further down the README (Build Spotlight), so they come last.
START = {
    "hero": 0.0,
    "link-site": 0.55, "link-linkedin": 0.67, "link-email": 0.79,
    "monthly": 1.05,
    "graph": 1.7,
    "repo-notebook-lm": 2.5, "repo-prism": 2.85, "repo-codefang": 3.2, "repo-recruitor-ai": 3.55,
}


# ── Fonts: metrics for layout, pyftsubset for embedding ──────────────────────
class Face:
    def __init__(self, family: str, file: str, fallback: str):
        self.family = family
        self.path = SRC / "fonts" / file
        self.fallback = fallback
        font = TTFont(self.path)
        self.cmap = font.getBestCmap()
        self.advance = font["hmtx"].metrics
        self.upm = font["head"].unitsPerEm
        self.cap = font["OS/2"].sCapHeight / self.upm

    def width(self, text: str, size: float, track: float = 0.0) -> float:
        total = 0
        for ch in text:
            glyph = self.cmap.get(ord(ch))
            if glyph is None:
                sys.exit(f"{self.path.name} has no glyph for {ch!r} (U+{ord(ch):04X}) in {text!r}")
            total += self.advance[glyph][0]
        return total * size / self.upm + track * size * len(text)

    def fit(self, text: str, largest: float, room: float, track: float = 0.0) -> float:
        """Largest size up to `largest` at which `text` fits in `room` px."""
        return min(largest, room / self.width(text, 1, track))

    def woff_base64(self, chars: set[str]) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            text_file = Path(tmp) / "chars.txt"
            text_file.write_text("".join(sorted(chars)), encoding="utf-8")
            out = Path(tmp) / "font.woff"
            # Same arguments as the pyftsubset command line; this is its entry point.
            subset.main([str(self.path), f"--text-file={text_file}", "--flavor=woff",
                         "--layout-features=kern", "--no-hinting", f"--output-file={out}"])
            return base64.b64encode(out.read_bytes()).decode("ascii")


FACES = {
    "fd": Face("D", "Archivo-CondensedBlack.ttf", '"Arial Narrow",Impact,sans-serif'),
    "fb": Face("B", "Archivo-Regular.ttf", "system-ui,-apple-system,Segoe UI,sans-serif"),
    "fm": Face("M", "JetBrainsMono-Regular.ttf", "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"),
    "fs": Face("S", "JetBrainsMono-SemiBold.ttf", "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"),
}
DISPLAY, BODY, MONO = FACES["fd"], FACES["fb"], FACES["fm"]
TRACK = 0.08   # the site's .label letter-spacing


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def mix(hex_a: str, hex_b: str, amount: float) -> str:
    """`amount` of colour a laid over colour b, as a solid hex."""
    a = [int(hex_a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hex_b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x * amount + y * (1 - amount)):02x}" for x, y in zip(a, b))


# ── Card: collects markup, the glyphs each font needs, and the keyframes ─────
BASE_CSS = """
.a{transform-box:fill-box;transform-origin:50% 50%}
.ab{transform-box:fill-box;transform-origin:50% 100%}
@keyframes up{from{opacity:0;transform:translateY(10px)}}
@keyframes fade{from{opacity:0}}
@keyframes grow{from{transform:scaleY(0)}}
@keyframes pop{from{opacity:0;transform:scale(.2)}}
@keyframes draw{from{stroke-dashoffset:1}}
@keyframes twinkle{50%{opacity:.06}}
.still{display:none}
@media (prefers-reduced-motion:reduce){
*{animation:none!important}
.smil{display:none}
.still{display:inline}
.typed{clip-path:none!important}
}"""


@dataclass
class Card:
    slug: str
    width: float
    height: float
    alt: str
    parts: list[str] = field(default_factory=list)
    defs: list[str] = field(default_factory=list)
    css: list[str] = field(default_factory=list)
    glyphs: dict[str, set[str]] = field(default_factory=dict)

    @property
    def start(self) -> float:
        return START[self.slug]

    def add(self, *markup: str) -> None:
        self.parts.extend(markup)

    def at(self, offset: float) -> float:
        return round(self.start + offset, 3)

    def mv(self, name: str, offset: float, dur: float = 0.9, ease: str = EXPO) -> str:
        """Inline animation, `offset` seconds after this card starts. Nothing when STATIC."""
        if STATIC:
            return ""
        return f' style="animation:{name} {dur}s {ease} {self.at(offset)}s both"'

    def keyframes(self, rule: str) -> None:
        if not STATIC:
            self.css.append(rule)

    def text(self, x: float, y: float, s: str, font: str, size: float, fill: str, *,
             anchor: str = "start", track: float = 0.0, cls: str = "", attrs: str = "") -> str:
        self.glyphs.setdefault(font, set()).update(s)
        spacing = f' letter-spacing="{track * size:.2f}"' if track else ""
        align = "" if anchor == "start" else f' text-anchor="{anchor}"'
        classes = f"{font} {cls}".strip()
        return (f'<text class="{classes}" x="{x:.1f}" y="{y:.1f}" font-size="{size:.1f}" '
                f'fill="{fill}"{spacing}{align}{attrs}>{esc(s)}</text>')

    def label(self, x: float, y: float, s: str, *, size: float = 11.5, fill: str = MUTED,
              anchor: str = "start", attrs: str = "") -> str:
        """Mono uppercase label, the site's .label style."""
        return self.text(x, y, s.upper(), "fm", size, fill, anchor=anchor, track=TRACK, attrs=attrs)

    def frame(self) -> None:
        self.add(f'<rect x=".5" y=".5" width="{self.width - 1}" height="{self.height - 1}" rx="14" '
                 f'fill="{CANVAS}" stroke="{LINE}"{self.mv("fade", 0, 0.5)}/>')

    def font_css(self) -> str:
        rules = []
        for key, chars in sorted(self.glyphs.items()):
            face = FACES[key]
            rules.append(f'@font-face{{font-family:{face.family};'
                         f'src:url(data:font/woff;base64,{face.woff_base64(chars)}) format("woff")}}')
            rules.append(f".{key}{{font-family:{face.family},{face.fallback}}}")
        return "\n".join(rules)

    def render(self) -> str:
        motion = "" if STATIC else BASE_CSS + "\n" + "\n".join(self.css)
        defs = f"<defs>{''.join(self.defs)}</defs>" if self.defs else ""
        body = "\n".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" '
                f'width="{self.width}" height="{self.height}" role="img" aria-label="{esc(self.alt)}">\n'
                f"<title>{esc(self.alt)}</title>\n<style>\n{self.font_css()}\n{motion}\n</style>\n"
                f"{defs}\n{body}\n</svg>\n")


def rise_words(card: Card, words: list[tuple[str, str]], x: float, base: float, size: float,
               offset: float, step: float = 0.06) -> float:
    """Display words that slide up out of a mask, the site's SplitHeading. Returns end x."""
    clip_id = f"rise{len(card.defs)}"
    top = base - DISPLAY.cap * size - 6
    total = sum(DISPLAY.width(w, size) for w, _ in words) + DISPLAY.width(" ", size) * (len(words) - 1)
    card.defs.append(f'<clipPath id="{clip_id}"><rect x="{x - 4}" y="{top:.1f}" '
                     f'width="{total + 8:.1f}" height="{base - top + 6:.1f}"/></clipPath>')
    card.keyframes(f"@keyframes {clip_id}{{from{{transform:translateY({size:.0f}px)}}}}")
    spans = []
    for i, (word, fill) in enumerate(words):
        spans.append(card.text(x, base, word, "fd", size, fill, attrs=card.mv(clip_id, offset + i * step, 1.0)))
        x += DISPLAY.width(word + " ", size)
    card.add(f'<g clip-path="url(#{clip_id})">{"".join(spans)}</g>')
    return x


def blink(card: Card, rect: str, offset: float) -> str:
    """A rect that blinks via SMIL. Reduced motion and STATIC show it solid instead."""
    if STATIC:
        return rect
    smil = rect.replace("/>", '><animate attributeName="opacity" values="1;0" calcMode="discrete" '
                              'dur="1.1s" repeatCount="indefinite"/></rect>')
    return f'<g{card.mv("fade", offset, 0.2, "linear")}><g class="smil">{smil}</g><g class="still">{rect}</g></g>'


# ── Contribution data ────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Day:
    day: date
    count: int
    level: int


def load_days(path: Path) -> tuple[int, tuple[Day, ...]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        sys.exit(f"Cannot read {path}: {error}")
    entries = raw.get("days") if isinstance(raw, dict) else None
    if not isinstance(entries, list) or not entries:
        sys.exit(f"{path} has no 'days' list")
    days = []
    for entry in entries:
        try:
            day = Day(date.fromisoformat(entry["date"]), int(entry["count"]), int(entry["level"]))
        except (KeyError, TypeError, ValueError) as error:
            sys.exit(f"{path}: bad day entry {entry!r} ({error})")
        if day.count < 0 or not 0 <= day.level <= 4:
            sys.exit(f"{path}: out-of-range day entry {entry!r}")
        days.append(day)
    days.sort(key=lambda d: d.day)
    total = raw.get("total")
    return (total if isinstance(total, int) else sum(d.count for d in days)), tuple(days)


def streaks(days: tuple[Day, ...]) -> tuple[int, int]:
    longest = run = 0
    for d in days:
        run = run + 1 if d.count else 0
        longest = max(longest, run)
    # Today can still be empty when the job runs; that doesn't end the streak yet.
    counted = days if days[-1].count else days[:-1]
    current = 0
    for d in reversed(counted):
        if not d.count:
            break
        current += 1
    return current, longest


def by_month(days: tuple[Day, ...], months: int = 12) -> list[tuple[date, int]]:
    totals: dict[date, int] = {}
    for d in days:
        key = d.day.replace(day=1)
        totals[key] = totals.get(key, 0) + d.count
    return sorted(totals.items())[-months:]


def long_date(d: date) -> str:
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def plural(n: int, word: str) -> str:
    return word if n == 1 else word + "s"


# ── Hero ─────────────────────────────────────────────────────────────────────
def stars(card: Card, avoid: tuple[float, float, float, float] | None) -> None:
    """A sparse field of dim points, the site's starfield. A few twinkle."""
    rng = random.Random(11)   # fixed seed: the same sky on every render
    dots = []
    while len(dots) < 28:
        x, y = rng.uniform(20, card.width - 20), rng.uniform(18, card.height - 18)
        if avoid and avoid[0] - 12 < x < avoid[2] + 12 and avoid[1] - 12 < y < avoid[3] + 12:
            continue
        r, alpha = rng.uniform(0.5, 1.15), rng.uniform(0.12, 0.42)
        twinkle = "" if STATIC or len(dots) % 5 else (
            f' style="animation:twinkle {rng.uniform(3, 6):.1f}s ease-in-out {rng.uniform(0, 3):.1f}s infinite"')
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="{BONE}" opacity="{alpha:.2f}"{twinkle}/>')
    card.add(f'<g{card.mv("fade", 0.1, 2.0, "ease-out")}>{"".join(dots)}</g>')


def portrait(card: Card, x: float, y: float, w: float, h: float, image: Path) -> None:
    data = base64.b64encode(image.read_bytes()).decode("ascii")
    card.defs.append(f'<clipPath id="pc"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14"/></clipPath>')
    card.add(f'<g{card.mv("up", 0.25, 1.2)}>'
             f'<image href="data:image/jpeg;base64,{data}" x="{x}" y="{y}" width="{w}" height="{h}" '
             f'preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>'
             f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="none" stroke="{LINE}"/></g>')


def status_line(card: Card, x: float, base: float, offset: float) -> None:
    cx, cy = x + 4, base - 4.5
    ring = "" if STATIC else (
        f'<g class="smil"><circle cx="{cx}" cy="{cy}" r="4" fill="none" stroke="{AMBER}" stroke-width="1.5" opacity="0">'
        f'<animate attributeName="r" values="4;11" dur="2.4s" begin="{card.at(offset + 0.4)}s" repeatCount="indefinite"/>'
        f'<animate attributeName="opacity" values=".55;0" dur="2.4s" begin="{card.at(offset + 0.4)}s" repeatCount="indefinite"/>'
        f"</circle></g>")
    card.add(f'<g{card.mv("up", offset)}>{ring}<circle cx="{cx}" cy="{cy}" r="4" fill="{AMBER}"/>'
             f'{card.text(x + 18, base, PROFILE["status"], "fb", 15, MUTED)}</g>')


def hero() -> Card:
    name = PROFILE["name"]
    line = " ".join(text for text, _ in PROFILE["line"])
    card = Card("hero", WIDE, 340, f"{name}. {PROFILE['label']}. {line} {PROFILE['status']}.")
    image = PROFILE["portrait"]
    has_portrait = bool(image) and Path(image).is_file()
    pw, ph = 208, 260
    px, py = WIDE - PAD - pw, (card.height - ph) / 2
    text_right = px - 44 if has_portrait else WIDE - PAD

    card.frame()
    stars(card, (px, py, px + pw, py + ph) if has_portrait else None)
    if has_portrait:
        portrait(card, px, py, pw, ph, Path(image))

    size = DISPLAY.fit(name.upper(), 124, text_right - PAD)
    block = 12 + 22 + DISPLAY.cap * size + 54 + 48   # label, gap, name, line, status
    label_y = (card.height - block) / 2 + 10
    name_y = label_y + 22 + DISPLAY.cap * size
    line_y, status_y = name_y + 54, name_y + 102

    card.add(card.label(PAD, label_y, PROFILE["label"], size=12, attrs=card.mv("up", 0.05)))
    rise_words(card, [(w, BONE) for w in name.upper().split()], PAD, name_y, size, 0.15, 0.08)

    x, i = PAD, 0
    for text, fill in PROFILE["line"]:
        for word in text.split():
            card.add(card.text(x, line_y, word, "fb", 23, fill, attrs=card.mv("up", 0.55 + i * 0.05)))
            x += BODY.width(word + " ", 23)
            i += 1
    status_line(card, PAD, status_y, 0.95)
    return card


# ── Link tiles: three across, each an <img> at 32.5% of the README column ────
def arrow(card: Card, x: float, y: float, s: float, offset: float) -> str:
    """↗ drawn as a path, so it needs no glyph and can draw itself in."""
    style = "" if STATIC else (f' stroke-dasharray="1" style="animation:draw .6s {EXPO} '
                               f'{card.at(offset)}s both"')
    return (f'<path d="M{x},{y + s} L{x + s},{y} M{x + s * 0.3},{y} H{x + s} V{y + s * 0.7}" '
            f'pathLength="1" fill="none" stroke="{AMBER}" stroke-width="1.8" stroke-linecap="round" '
            f'stroke-linejoin="round"{style}/>')


def tile(link: Link, number: int) -> Card:
    width = round(WIDE * 0.325)
    card = Card(f"link-{link.slug}", width, 128, f"{link.title}: {link.value}")
    card.frame()
    card.add(card.label(20, 32, f"{number:02d} / {link.kind}", size=11, attrs=card.mv("up", 0.1)))
    card.add(arrow(card, width - 34, 20, 13, 0.5))
    size = DISPLAY.fit(link.title.upper(), 46, width - 40)
    rise_words(card, [(link.title.upper(), BONE)], 20, 84, size, 0.15)
    value_size = MONO.fit(link.value, 11.5, width - 40)
    card.add(card.text(20, 108, link.value, "fm", value_size, MUTED, attrs=card.mv("up", 0.35)))
    return card


# ── Contributions per month, with streak, active days and busiest day ────────
def bar_path(x: float, y: float, w: float, h: float, r: float = 3) -> str:
    """A bar with only its top corners rounded."""
    r = min(r, h / 2, w / 2)
    return (f"M{x:.1f},{y + h:.1f}V{y + r:.1f}Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f}"
            f"H{x + w - r:.1f}Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f}V{y + h:.1f}Z")


def month_bars(card: Card, months: list[tuple[date, int]], today: date,
               box: tuple[float, float, float, float]) -> None:
    left, top, right, base = box
    slot = (right - left) / len(months)
    bar_w = min(28, slot * 0.62)
    peak = max(count for _, count in months) or 1
    soft = mix(AMBER, CANVAS, 0.34)
    card.add(f'<line x1="{left}" y1="{base + 0.5}" x2="{right}" y2="{base + 0.5}" stroke="{LINE}"/>')
    for i, (month, count) in enumerate(months):
        x = left + slot * i + (slot - bar_w) / 2
        cx = x + bar_w / 2
        h = max(2.0, (base - top) * count / peak)
        is_peak = count == peak
        fill = AMBER if is_peak else (soft if count else LINE)
        at = 0.25 + i * 0.07
        card.add(f'<path class="ab" d="{bar_path(x, base - h, bar_w, h)}" fill="{fill}"{card.mv("grow", at, 1.0)}/>')
        card.add(card.text(cx, base - h - 8, str(count), "fm", 10.5, AMBER if is_peak else MUTED,
                           anchor="middle", attrs=card.mv("up", at + 0.45, 0.6)))
        card.add(card.label(cx, base + 20, MONTHS[month.month - 1], size=10, anchor="middle",
                            attrs=card.mv("fade", at, 0.6)))
        if (month.year, month.month) == (today.year, today.month):
            card.add(card.text(cx, base + 34, "to date", "fm", 9.5, MUTED, anchor="middle",
                               attrs=card.mv("fade", at, 0.6)))


def stat(card: Card, x: float, base: float, value: int, unit: str, label: str, offset: float) -> None:
    number = f"{value:,}"
    size = 46
    unit_x = x + DISPLAY.width(number, size) + 8
    card.add(f'<g{card.mv("up", offset)}>'
             f'{card.text(x, base, number, "fd", size, AMBER)}'
             f'{card.text(unit_x, base, unit, "fm", 12, MUTED)}'
             f'{card.label(x, base + 21, label, size=10.5)}</g>')


def month_span(months: list[tuple[date, int]]) -> str:
    first, last = months[0][0], months[-1][0]
    return f"{MONTHS[first.month - 1]} {first.year} — {MONTHS[last.month - 1]} {last.year}"


def monthly(days: tuple[Day, ...]) -> Card:
    months = by_month(days)
    current, longest = streaks(days)
    active = sum(1 for d in days if d.count)
    busiest = max(days, key=lambda d: (d.count, d.day))
    span = month_span(months)
    alt = (f"Contributions per month, {span}: "
           + ", ".join(f"{MONTHS[m.month - 1].title()} {c}" for m, c in months)
           + f". Current streak {current} {plural(current, 'day')}, longest {longest}. "
           f"{active} active days in the last {len(days)}. Busiest day {long_date(busiest.day)}, "
           f"{busiest.count} contributions.")
    card = Card("monthly", WIDE, 322, alt)
    card.frame()
    split = 604
    card.add(card.label(PAD, 54, "Contributions per month", size=12, attrs=card.mv("up", 0.05)))
    card.add(card.label(split - 44, 54, span, size=10.5, anchor="end", attrs=card.mv("up", 0.1)))
    month_bars(card, months, days[-1].day, (PAD, 96, split - 44, 254))
    card.add(f'<line x1="{split}" y1="40" x2="{split}" y2="{card.height - 40}" stroke="{LINE}"'
             f'{card.mv("fade", 0.2)}/>')
    sx = split + 36
    card.add(card.label(sx, 54, "The last year", size=12, attrs=card.mv("up", 0.1)))
    stat(card, sx, 118, current, plural(current, "day"), f"Current streak · best {longest}", 0.5)
    stat(card, sx, 192, active, plural(active, "day"), f"Active · of the last {len(days)}", 0.62)
    stat(card, sx, 266, busiest.count, plural(busiest.count, "contribution"),
         f"Busiest day · {long_date(busiest.day)}", 0.74)
    return card


# ── Contribution graph, in amber ─────────────────────────────────────────────
CELL, PITCH = 11, 14
LEVELS = (mix(BONE, CANVAS, 0.06), mix(AMBER, CANVAS, 0.24), mix(AMBER, CANVAS, 0.44),
          mix(AMBER, CANVAS, 0.7), AMBER)


def grid_position(first: date, d: date) -> tuple[int, int]:
    """(column, row) in a Sunday-first week grid, as GitHub draws it."""
    first_sunday = first.toordinal() - (first.weekday() + 1) % 7
    return (d.toordinal() - first_sunday) // 7, (d.weekday() + 1) % 7


def graph_labels(card: Card, days: tuple[Day, ...], gx: float, gy: float) -> None:
    last_month, last_col = None, -9
    for d in days:
        if d.day.month == last_month:
            continue
        last_month = d.day.month
        col, _ = grid_position(days[0].day, d.day)
        if col - last_col < 3:   # a partial first week would crowd the next label
            continue
        last_col = col
        card.add(card.label(gx + col * PITCH, gy - 10, MONTHS[d.day.month - 1], size=10,
                            attrs=card.mv("fade", 0.2 + col * 0.012, 0.5)))
    for row, name in ((1, "Mon"), (3, "Wed"), (5, "Fri")):
        card.add(card.label(gx - 10, gy + row * PITCH + 9, name, size=10, anchor="end",
                            attrs=card.mv("fade", 0.2, 0.5)))


def graph_legend(card: Card, right: float, y: float, offset: float) -> None:
    parts = [card.label(right, y, "more", size=10, anchor="end")]
    x = right - MONO.width("MORE", 10, TRACK) - 8 - CELL
    for fill in reversed(LEVELS):
        parts.append(f'<rect x="{x:.1f}" y="{y - 9.5}" width="{CELL}" height="{CELL}" rx="2.5" fill="{fill}"/>')
        x -= PITCH
    parts.append(card.label(x + PITCH - 8, y, "less", size=10, anchor="end"))
    card.add(f'<g{card.mv("fade", offset, 0.6)}>{"".join(parts)}</g>')


def graph_cells(card: Card, days: tuple[Day, ...], gx: float, gy: float, cols: int) -> None:
    """Cells pop in column by column, left to right."""
    cells = []
    for d in days:
        col, row = grid_position(days[0].day, d.day)
        cells.append(f'<rect class="a cell c{col}" x="{gx + col * PITCH}" y="{gy + row * PITCH}" '
                     f'width="{CELL}" height="{CELL}" rx="2.5" fill="{LEVELS[d.level]}"/>')
    card.add(f"<g>{''.join(cells)}</g>")
    card.keyframes(f".cell{{animation:pop .5s {EXPO} both}}")
    for col in range(cols):
        card.keyframes(f".cell.c{col}{{animation-delay:{card.at(0.3 + col * 0.022)}s}}")


def graph(total: int, days: tuple[Day, ...]) -> Card:
    cols = grid_position(days[0].day, days[-1].day)[0] + 1
    grid_w = cols * PITCH - (PITCH - CELL)
    gx, gy = round((WIDE - grid_w) / 2 + 12), 84
    bottom = gy + 7 * PITCH - (PITCH - CELL)
    busiest = max(days, key=lambda d: (d.count, d.day))
    span = f"{long_date(days[0].day)} — {long_date(days[-1].day)}"
    card = Card("graph", WIDE, bottom + 62,
                f"Contribution graph, {span}: {total:,} contributions. "
                f"Busiest day {long_date(busiest.day)} with {busiest.count}.")
    card.frame()
    right = gx + grid_w
    card.add(card.label(gx, 46, "Contribution graph", size=12, attrs=card.mv("up", 0.05)))
    tail = "contributions in the last year"
    number_x = right - MONO.width(tail.upper(), 10.5, TRACK) - 10
    card.add(f'<g{card.mv("up", 0.1)}>{card.label(right, 46, tail, size=10.5, anchor="end")}'
             f'{card.text(number_x, 47, f"{total:,}", "fd", 30, AMBER, anchor="end")}</g>')
    graph_labels(card, days, gx, gy)
    graph_cells(card, days, gx, gy, cols)

    # Outline the busiest day once the sweep has passed it: the same day the chart card names.
    col, row = grid_position(days[0].day, busiest.day)
    ring_at = 0.3 + cols * 0.022 + 0.3
    card.add(f'<rect class="a" x="{gx + col * PITCH - 2.5}" y="{gy + row * PITCH - 2.5}" width="{CELL + 5}" '
             f'height="{CELL + 5}" rx="4" fill="none" stroke="{BONE}" stroke-width="1.2"'
             f'{card.mv("pop", ring_at, 0.6)}/>')

    foot = bottom + 34
    note = f"outlined: busiest day, {busiest.count}"
    card.add(f'<g{card.mv("fade", ring_at, 0.6)}>{card.label(gx, foot, span, size=10)}'
             f'{card.label(gx + MONO.width(span.upper(), 10, TRACK) + 22, foot, note, size=10)}</g>')
    graph_legend(card, right, foot, ring_at)
    return card


# ── Featured repos ───────────────────────────────────────────────────────────
TERM_W, TERM_SIZE, TERM_LINE = 300, 12, 24
PILL_H, PILL_GAP = 26, 8


def wrap(face: Face, text: str, size: float, room: float) -> list[str]:
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if current and face.width(trial, size) > room:
            lines.append(current)
            current = word
        else:
            current = trial
    return lines + ([current] if current else [])


def pill_rows(tags: tuple[str, ...], room: float) -> list[list[tuple[str, float]]]:
    """Tags packed into rows that fit `room`; each tag paired with its pill width."""
    rows: list[list[tuple[str, float]]] = [[]]
    used = 0.0
    for tag in tags:
        w = MONO.width(tag, 11) + 22
        if rows[-1] and used + PILL_GAP + w > room:
            rows.append([])
            used = 0.0
        used += (PILL_GAP if rows[-1] else 0) + w
        rows[-1].append((tag, w))
    return rows


def pills(card: Card, rows: list[list[tuple[str, float]]], x0: float, y0: float, offset: float) -> None:
    i = 0
    for r, row in enumerate(rows):
        x, y = x0, y0 + r * (PILL_H + PILL_GAP)
        for tag, w in row:
            card.add(f'<g{card.mv("up", offset + i * 0.05, 0.7)}>'
                     f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="{PILL_H}" rx="{PILL_H / 2}" '
                     f'fill="none" stroke="{LINE}"/>'
                     f'{card.text(x + 11, y + 17.5, tag, "fm", 11, MUTED)}</g>')
            x += w + PILL_GAP
            i += 1


def line_parts(line: str) -> list[tuple[str, str, str]]:
    """(text, font, colour) runs for one terminal line. A leading ✓ is drawn, not set."""
    if line.startswith("✓"):
        return [("✓", "", MERGED), (line[1:], "fm", MERGED)]
    if line[:2] in ("$ ", "? "):
        return [(line[0], "fs", AMBER), (line[1:], "fm", BONE)]
    return [(line, "fm", MUTED)]


def tick(x: float, base: float, w: float, colour: str) -> str:
    """✓ as a path one mono cell wide: neither site font has the glyph."""
    return (f'<path d="M{x + w * 0.12:.1f},{base - 4.5:.1f} L{x + w * 0.42:.1f},{base - 1.5:.1f} '
            f'L{x + w * 0.9:.1f},{base - 9.5:.1f}" fill="none" stroke="{colour}" stroke-width="1.7" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def typed_line(card: Card, line: str, x: float, base: float, begin: float, index: int) -> float:
    """One terminal line typed out a character at a time with a SMIL clip. Returns its duration."""
    runs, cx = [], x
    for text, font, fill in line_parts(line):
        if not font:
            runs.append(tick(cx, base, MONO.width("M", TERM_SIZE), fill))
            cx += MONO.width("M", TERM_SIZE)
            continue
        # SVG collapses a run's leading spaces, so step over them instead of setting them.
        body = text.lstrip(" ")
        cx += FACES[font].width(text[:len(text) - len(body)], TERM_SIZE)
        runs.append(card.text(cx, base, body, font, TERM_SIZE, fill))
        cx += FACES[font].width(body, TERM_SIZE)
    if STATIC:
        card.add("".join(runs))
        return 0.0
    step = MONO.width("M", TERM_SIZE)
    dur = round(len(line) * 0.028, 3)
    widths = ";".join(f"{k * step + 1:.1f}" for k in range(len(line) + 1))
    clip = f"t{index}"
    card.defs.append(f'<clipPath id="{clip}"><rect x="{x - 1}" y="{base - 13}" width="0" height="18">'
                     f'<animate attributeName="width" values="{widths}" calcMode="discrete" '
                     f'begin="{card.at(begin)}s" dur="{dur}s" fill="freeze"/></rect></clipPath>')
    card.add(f'<g class="typed" style="clip-path:url(#{clip})">{"".join(runs)}</g>')
    return dur


def terminal_height(repo: Repo) -> float:
    return 44 + len(repo.preview) * TERM_LINE + 12


def terminal(card: Card, repo: Repo, x: float, y: float, h: float, offset: float) -> None:
    card.add(f'<g{card.mv("up", offset)}><rect x="{x}" y="{y}" width="{TERM_W}" height="{h}" rx="10" '
             f'fill="{SURFACE}" stroke="{LINE}"/>'
             f'<line x1="{x}" y1="{y + 34.5}" x2="{x + TERM_W}" y2="{y + 34.5}" stroke="{LINE}"/>'
             f'{card.label(x + 16, y + 22, repo.shell, size=10.5)}'
             + "".join(f'<circle cx="{x + TERM_W - 18 - k * 13}" cy="{y + 17.5}" r="3.5" fill="{LINE}"/>'
                       for k in range(3))
             + "</g>")
    begin = offset + 0.45
    tx = x + 16
    for i, line in enumerate(repo.preview):
        base = y + 44 + (i + 1) * TERM_LINE - 6
        begin += typed_line(card, line, tx, base, begin, i) + 0.14
    last = repo.preview[-1]
    cursor_x = tx + len(last) * MONO.width("M", TERM_SIZE) + 4   # monospace: one cell per character
    cursor_y = y + 44 + len(repo.preview) * TERM_LINE - 17
    card.add(blink(card, f'<rect x="{cursor_x:.1f}" y="{cursor_y:.1f}" width="7" height="14" fill="{AMBER}"/>',
                   begin))


def repo_card(repo: Repo, index: int) -> Card:
    term_x = WIDE - PAD - TERM_W
    room = term_x - 44 - PAD
    name_size = DISPLAY.fit(repo.name.upper(), 64, room)
    name_y = 58 + 20 + DISPLAY.cap * name_size
    summary = wrap(BODY, repo.summary, 15.5, room)
    summary_y = name_y + 38
    rows = pill_rows(repo.tags, room)
    tags_y = summary_y + (len(summary) - 1) * 24 + 22
    left_bottom = tags_y + len(rows) * (PILL_H + PILL_GAP) - PILL_GAP
    term_y = 44
    # The terminal runs as deep as the text column, so the two columns end together.
    term_h = max(terminal_height(repo), left_bottom - term_y)
    height = round(term_y + term_h + 44)

    card = Card(f"repo-{repo.slug}", WIDE, height, f"{repo.name} — {repo.kicker}. {repo.summary} "
                f"Built with {', '.join(repo.tags)}. " + " · ".join(repo.preview))
    card.frame()
    card.add(card.label(PAD, 58, f"{index:02d} / {repo.kicker}", size=11.5, attrs=card.mv("up", 0.05)))
    rise_words(card, [(repo.name.upper(), BONE)], PAD, name_y, name_size, 0.12)
    for i, text in enumerate(summary):
        card.add(card.text(PAD, summary_y + i * 24, text, "fb", 15.5, BONE, attrs=card.mv("up", 0.35 + i * 0.07)))
    pills(card, rows, PAD, tags_y, 0.4 + len(summary) * 0.07)
    terminal(card, repo, term_x, term_y, term_h, 0.3)
    return card


# ── Output ───────────────────────────────────────────────────────────────────
def preview_html(cards: dict[str, Card]) -> str:
    """The cards stacked the way the README stacks them, at GitHub's column width."""
    def img(slug: str, width: str = "100%") -> str:
        return f'<img src="{slug}.svg" width="{width}" alt="{esc(cards[slug].alt)}">'

    tiles = " ".join(img(f"link-{link.slug}", "32.5%") for link in LINKS)
    repos = "\n".join(f"<p>{img(f'repo-{repo.slug}')}</p>" for repo in REPOS)
    mode = "final frame (STATIC=1)" if STATIC else "animated — reload to replay"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Profile cards preview</title>
<style>
body{{margin:0;background:#0d1117;color:#8b949e;font:14px/1.5 system-ui,sans-serif}}
main{{max-width:830px;margin:32px auto;padding:0 16px}}
p{{margin:0 0 12px;text-align:center}} img{{max-width:100%;vertical-align:top}}
h2{{color:#e6edf3;font-size:20px;border-bottom:1px solid #30363d;padding-bottom:6px;margin:40px 0 16px}}
</style></head><body><main>
<p style="text-align:left">Preview: {mode}</p>
<p>{img("hero")}</p>
<p>{tiles}</p>
<p>{img("monthly")}</p>
<p>{img("graph")}</p>
<h2>Build Spotlight</h2>
{repos}
</main></body></html>
"""


def build() -> dict[str, Card]:
    total, days = load_days(DATA_FILE)
    cards = [hero(), *(tile(link, i + 1) for i, link in enumerate(LINKS)),
             monthly(days), graph(total, days), *(repo_card(repo, i + 1) for i, repo in enumerate(REPOS))]
    return {card.slug: card for card in cards}


def main() -> None:
    cards = build()
    OUT.mkdir(exist_ok=True)
    for slug, card in cards.items():
        svg = card.render()
        (OUT / f"{slug}.svg").write_text(svg, encoding="utf-8")
        print(f"{OUT.name}/{slug}.svg  {len(svg.encode()) / 1024:6.1f} KB")
    (OUT / "preview.html").write_text(preview_html(cards), encoding="utf-8")
    print(f"{OUT.name}/preview.html")


if __name__ == "__main__":
    main()
