"""Build the Crawling Clock reference page: every value 1-20, outside Foundry.

The page it produces is the artefact — `docs/design/crawling-clock-values.html`, committed
and self-contained, openable by double-clicking with no server and no Foundry running.
This script exists only to rebuild it after `crawling-clock.css` or the die changes.

    uv run python tools/preview/crawling-clock.py     # or: npm run preview:clock

The page draws all 20 values plus the low and stirs states from the **shipped** stylesheet
and the **generated** die, at the real 180px width. It also drives the real rotation: the
demo at the top swaps the same orientation class the widget swaps, so the turn can be
judged here rather than in Foundry.

A checkbox overlays the die's centre facet in red and the target ink centre in blue — that
is the view the counter's per-value fitting was judged against, and the one to reach for
when a number looks wrong: it shows whether it is off-centre or simply too big for the
plate. It doubles as a check on the geometry: the solid is scaled so that its front face,
once perspective has magnified it, lands exactly inside that red outline.

The font is JSL Blackletter, which ships with the Shadowdark system rather than with us. It
is embedded as a data URI so the page stands alone. Its licence permits free distribution
provided it travels unaltered and accompanied by its readme, so `JBLACK.TXT` is copied in
beside the page and must stay there.
"""

import base64
import pathlib
import re
import shutil
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
CSS = REPO / "module/styles/crawling-clock.css"
DIE_CSS = REPO / "module/styles/crawling-clock-d20.css"
DIE_JS = REPO / "module/src/crawling-clock-d20.js"

OUT_DIR = REPO / "docs/design"
OUT = OUT_DIR / "crawling-clock-values.html"
FONT_LICENCE = OUT_DIR / "JBLACK.TXT"

# Borrowed from the Shadowdark system; never committed as a .TTF of its own.
STORYBOOK = REPO / "tests/visual-storybook"
FONT_IN_CONTAINER = "/data/Data/systems/shadowdark/fonts"

# The centre facet, from tools/d20/generate-d20.py.
FACET = "25.3,64.3 50.4,21.5 74.6,64.3"
FACET_CENTROID_Y = (21.5 + 64.3 + 64.3) / 3

# The clock runs across the die's faces, one value each.
MIN, MAX = 1, 20


def font_files():
    """Return (ttf_bytes, licence_text), fetching from the container if needed."""
    ttf, txt = STORYBOOK / "JBLACK.TTF", STORYBOOK / "JBLACK.TXT"
    if not (ttf.exists() and txt.exists()):
        if not shutil.which("docker"):
            sys.exit(f"Need JBLACK.TTF and JBLACK.TXT in {STORYBOOK}, and no docker to "
                     f"copy them from. Start the dev container or place them by hand.")
        STORYBOOK.mkdir(parents=True, exist_ok=True)
        for name in ("JBLACK.TTF", "JBLACK.TXT"):
            r = subprocess.run(
                ["docker", "cp", f"foundry:{FONT_IN_CONTAINER}/{name}", str(STORYBOOK / name)],
                capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f"Could not copy {name} out of the container:\n{r.stderr}")
    return ttf.read_bytes(), txt.read_text(errors="replace")


def numbering():
    """Which number is on which face, lifted out of the generated JS module."""
    js = DIE_JS.read_text()
    numbers = [int(n) for n in
               re.search(r"D20_VALUES = \[([^\]]+)\]", js).group(1).split(",")]
    assert len(numbers) == 20, len(numbers)
    return numbers


def die(value, numbers):
    """Mirrors ccDieMarkup() in crawling-clock.js. Keep the two in step."""
    faces = "".join(
        f'<div class="cc-d20-3d__face cc-d20-3d__face--f{i}">'
        f'<div class="cc-d20-3d__plate"></div>'
        f'<div class="crawling-clock__value crawling-clock__value--v{n}">{n}</div></div>'
        for i, n in enumerate(numbers))
    return (f'<div class="cc-d20-3d"><div class="cc-d20-3d__body cc-d20-3d__body--to{value}" '
            f'data-cc-face="{value}">{faces}</div></div>')


def state_class(value):
    """Mirrors the widget: 1 is stirs, 6 and under is low."""
    if value == MIN:
        return " crawling-clock--stirs"
    return " crawling-clock--low" if value <= 6 else ""


def widget(value, numbers):
    stirs = ('<div class="crawling-clock__stirs">The dungeon stirs.</div>'
             if value == MIN else "")
    disabled = " disabled" if value == MIN else ""
    guides = (f'<svg class="pv-guide" viewBox="0 0 100 100">'
              f'<polygon points="{FACET}"/>'
              f'<line x1="20" y1="{FACET_CENTROID_Y:.2f}" '
              f'x2="80" y2="{FACET_CENTROID_Y:.2f}"/></svg>')
    return f"""<div class="pv-cell">
  <div id="crawling-clock"><div class="crawling-clock{state_class(value)}">
    <div class="crawling-clock__die">{die(value, numbers)}{guides}</div>
    {stirs}
    <div class="crawling-clock__roll-line">Player2 rolled 4</div>
    <button type="button" class="crawling-clock__roll"{disabled}>Roll 1d6</button>
    <div class="crawling-clock__gm">
      <button type="button">&minus;</button><button type="button">+</button>
      <button type="button">Reset</button>
    </div>
  </div></div>
  <div class="pv-label">{value}</div>
</div>"""


def main():
    ttf, licence = font_files()
    numbers = numbering()
    cells = "\n".join(widget(v, numbers) for v in range(MAX, MIN - 1, -1))
    demo = die(MAX, numbers)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FONT_LICENCE.write_text(licence)
    OUT.write_text(f"""<!doctype html>
<meta charset="utf-8">
<title>The Crawling Clock — every value</title>
<style>
/* JSL Blackletter, (c) 1997-2000 Jeffrey S. Lee. Distributed unaltered under its own
   terms; see JBLACK.TXT beside this file. Ships with the Shadowdark system. */
@font-face {{
  font-family: "JSL Blackletter";
  src: url("data:font/ttf;base64,{base64.b64encode(ttf).decode()}") format("truetype");
}}
/* Foundry supplies these; the widget's stylesheet reads them. */
:root {{ --font-size-12: 12px; --font-size-13: 13px; --font-size-14: 14px; }}
body {{
  background: #0e0e11; margin: 0; padding: 20px;
  font-family: "Signika", -apple-system, sans-serif;
}}
h1 {{ color: #e8dcc8; font-size: 15px; font-weight: normal; margin: 0 0 6px; }}
.pv-note {{ color: #7a7a80; font-size: 12px; margin: 0 0 14px; max-width: 70ch;
            line-height: 1.5; }}
.pv-toggle {{ color: #b0a898; font-size: 12px; display: block; margin: 0 0 16px;
              cursor: pointer; user-select: none; }}
.pv-grid {{ display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }}
.pv-demo {{ display: flex; align-items: center; gap: 18px; margin: 0 0 18px;
            padding: 14px; border: 1px solid #26262b; border-radius: 4px; }}
.pv-demo #crawling-clock {{ width: 200px; }}
.pv-demo button {{ background: transparent; border: 1px solid #c9a54a; border-radius: 3px;
                   padding: 7px 14px; color: #d4a843; font: inherit; font-size: 12px;
                   cursor: pointer; }}
.pv-demo p {{ color: #7a7a80; font-size: 12px; margin: 0; max-width: 46ch;
              line-height: 1.5; }}
.pv-cell #crawling-clock {{ width: 100%; }}
.pv-label {{ color: #5a5a60; font-size: 11px; text-align: center; margin-top: 2px; }}
.pv-guide {{ position: absolute; inset: 0; width: 100%; height: 100%; display: none; }}
.pv-guide polygon {{ fill: none; stroke: #cc4444; stroke-width: .5; opacity: .85; }}
.pv-guide line {{ stroke: #4488cc; stroke-width: .5; opacity: .9; }}
#pv-guides:checked ~ .pv-grid .pv-guide {{ display: block; }}

/* ---- module/styles/crawling-clock-d20.css, verbatim (generated geometry) ---- */
{DIE_CSS.read_text()}

/* ---- module/styles/crawling-clock.css, verbatim ---- */
{CSS.read_text()}
</style>
<h1>The Crawling Clock — every value</h1>
<p class="pv-note">
  The widget as it ships: the real stylesheet, the generated die at its real 180px, and
  JSL Blackletter embedded so this page stands alone. Values 6 and under carry the low
  state, 1 the stirs state. Rebuild with <code>npm run preview:clock</code> after changing
  the stylesheet or the die.
</p>
<div class="pv-demo">
  <div id="crawling-clock"><div class="crawling-clock">
    <div class="crawling-clock__die">{demo}</div>
  </div></div>
  <div>
    <p>The turn itself, driven exactly as the widget drives it: one class swapped on the
    body, and the browser slerps between the two orientations. Nothing computes a path;
    both classes are 3D matrices and the browser takes the short way round on its own.</p>
    <p style="margin-top:10px"><button id="pv-roll" type="button">Roll 1d6</button>
    <span id="pv-said" style="margin-left:10px"></span></p>
  </div>
</div>

<script>
// Mirrors _turnDie() in crawling-clock.js: swap the orientation class, let CSS do the rest.
const body = document.querySelector(".pv-demo .cc-d20-3d__body");
const said = document.getElementById("pv-said");
document.getElementById("pv-roll").addEventListener("click", () => {{
  const from = Number(body.dataset.ccFace);
  const rolled = 1 + Math.floor(Math.random() * 6);
  const to = Math.max({MIN}, from - rolled);
  said.textContent = from === to ? "already at " + {MIN} : "rolled " + rolled + " \u2192 " + to;
  if (from === to) return;
  body.classList.replace("cc-d20-3d__body--to" + from, "cc-d20-3d__body--to" + to);
  body.dataset.ccFace = to;
}});
</script>

<input type="checkbox" id="pv-guides" hidden>
<label class="pv-toggle" for="pv-guides">
  ☐ Show the facet guides — red outlines the die's centre facet, blue marks where each
  number's ink should be centred
</label>
<div class="pv-grid">
{cells}
</div>
""")
    kb = OUT.stat().st_size // 1024
    print(f"wrote {OUT.relative_to(REPO)} ({kb} KB, font embedded)")
    print(f"wrote {FONT_LICENCE.relative_to(REPO)} (required alongside it)")
    print(f"open it:  open {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
