# 2026-08-18 — Crawling Clock: implementation

Implementation session, following on directly from `2026-08-18-001`. The feature was built
end to end, verified in the dev world, given its d20 artwork, and the counter's typography
fitted to the die. Nine commits on branch **`task-067-crawling-clock`**, not pushed.

The planned three-step build order (068 base → 071 feel → 072 packaging) was **abandoned
during the session**. Everything was built from task 067 directly; 068, 071 and 072 are now
in `todo/rejected/`.

## What was accomplished

### The feature

`module/src/crawling-clock.js` — settings, socket handler and widget in one file.

- `crawlingClockValue` (world, `config: false`) is the truth, written **only** by the
  active GM. `crawlingClockDie` (world, `config: true`, default `1d6`) is the only
  user-facing setting.
- Socket channel `module.foundry-homebrew`, payload `{ action: "roll", rolled, userId }`.
  Handler registered at **module scope** in `Hooks.once("ready")`.
- Roll flow: click → `new Roll(die).evaluate()` → emit → call the same handler locally.
  One code path; the roller is not special-cased.
- The GM writes the setting, whispers itself `"Allard rolled 4. Clock: 14."`, and posts one
  public `"The dungeon stirs."` at 0.
- GM-only `−` / `+` / `Reset`, written as plain setting changes so everyone repaints via
  `onChange`.
- At 0 the roll button is genuinely `disabled`, not merely dimmed.

### Files changed

| File | What |
|------|------|
| `module/src/crawling-clock.js` | **New.** The whole feature. |
| `module/src/crawling-clock-d20.js` | **New, generated.** The d20 SVG as an exported string. Do not hand-edit. |
| `module/styles/crawling-clock.css` | **New.** Includes the per-value counter table. |
| `module/macros/crawling-clock-macro.js` | **New.** One-liner calling `toggleInterface()`. |
| `module/macros/macros.json` | Added id `Zc7vQm3XtLpR8yKd`, icon `icons/svg/clockwork.svg` (core Foundry icon; nothing in `assets/images/` fitted). |
| `module/module.json` | `"socket": true`; script before `module-ready.js`; stylesheet appended. **No version bump** — see below. |
| `tools/d20/generate-d20.py` | **New.** Generates the die. |
| `todo/done/task-067-…` | Results and acceptance criteria rewritten to match what shipped. |
| `todo/rejected/task-068/071/072` | Rejected; `crawlingClockMax` scrubbed from all of them. |
| `docs/design/crawling-clock-direction-1-obsidian-dial.png` | Was a stray `d1.png` at repo root — an early visual direction. |

### The d20 artwork

`tools/d20/generate-d20.py` computes a real icosahedron, rotates one face to the viewer,
drops the back faces and fills the ten front facets with pen hatching whose density follows
a light direction. The centre facet is left bare — that is the counter's plate. Regenerate
with:

    uv run --with numpy python tools/d20/generate-d20.py

Fixed seed, so output is stable. It rewrites `module/src/crawling-clock-d20.js`.

The SVG is **inline markup, not an `<img>`**, because `--low` and `--stirs` recolour its
strokes and an image cannot be restyled. It carries classes only; all colour is in the
stylesheet.

## Key decisions

### The artwork had to be original

The user found a reference image (`wallhalla.com/embrace-the-chaos/`) whose hand-inked style
was exactly right, and asked whether cropping and recolouring it made it "derived enough".
It does not — that is what derivative work means, and `release.yml` zips `assets/` into
every public release. The generator exists so the style could be reproduced from scratch.
**Do not reintroduce that image.** It is not in the repo.

### `crawlingClockMax` was removed entirely

The clock is a d20 and starts at 20; any other maximum makes the die drawn on the widget a
lie. It is now the constant `CC_CLOCK_MAX`. The user asked for it gone from all
documentation too, so it is scrubbed from 067 and the rejected tasks. **Do not add it
back.** What is worth varying is the die that decrements it.

Existing worlds still carry the orphaned setting in their database. It is inert and needs
no migration.

### The counter's typography — the fiddly part

JSL Blackletter (from the Shadowdark system, `fonts/JBLACK.TTF`, declared via `@font-face`
in the system CSS) has **old-style figures**: 3 4 5 7 9 descend, 6 rises, 8 rises further.
So every number shares a baseline but its *ink* sits somewhere different — measured spread
across 0-20 was 12.1px at a 48px type size. 5 hung out of the facet; 8 rode high.
`font-variant-numeric: lining-nums` does nothing; the font has no such feature.

Because the clock only ever shows 0-20, each value has its own class
(`.crawling-clock__value--vN`) and the stylesheet places it individually: ink box measured
from the font, centred on the facet's centroid, sized to keep 1.6 units of clearance. Twenty
of twenty-one share 48px. 14, 20 and 17 were then hand-tuned at the user's request.

Two properties of this that will bite anyone changing it:

- **The facet narrows towards the apex, so raising a number costs it size.** Targeting three
  units higher makes seven values shrink; five units higher, ten. The centroid is the
  highest position that keeps the set at one size.
- **The shifts are `em`**, resolved against `--cc-figure-size` on the same line. Change a
  size without recomputing its shift and the number drifts. The derivation is documented
  above the table in the CSS.

An intermediate attempt grouped numbers into six typographic buckets. Abandoned. It had been
positioned on the wrong assumption that **the text baseline sits at the centre of its line
box** — it does not, which is why that version sat uniformly low.

### Rejecting 068/071/072

The base was built directly from 067, so 068 was redundant. 071 (feel) and 072 (packaging)
were partly absorbed — the macro, the d20, and the low/stirs states all shipped — and the
remainder dropped. The **die animation and the zero sound were never built** and are the
only unchecked boxes in 067.

The sound is chosen but not in the repo: freesound.org 655238, "Dice Rolling.wav" by
**Gamufreaku**, **CC BY 4.0**. Only the **first second** is wanted — the die landing on
wood. Attribution is a condition of the licence, so `LICENSE` (currently plain MIT with no
third-party section) needs one when the audio lands, not before. Details in 067 under
"Notes for the parts that were not built".

## Important context for future sessions

### Branch and release status

Branch `task-067-crawling-clock`, **not pushed**, no tag. `module.json` is deliberately
still at 1.2.0: `.github/workflows/release.yml` stamps the version from the git tag into
both `package.json` and `module.json`, so a manual bump is pointless and would be
overwritten. Releasing is `git tag v1.3.0 && git push --tags`. Task 072's "bump the version"
instruction was wrong about this. Tags are never deleted or moved.

`module/packs/` is gitignored — the pack is a build artefact, rebuilt by CI. A pre-commit
hook runs `npm run build` on every commit.

### The known correctness hole

`game.users.activeGM === game.user` compares **User documents**, so it does not distinguish
two connections of the *same* GM user — two browser tabs, or a laptop and a tablet. Every
such connection passes the guard and writes its own whisper. This was hit for real during
testing (two duplicate whispers, screenshot-confirmed by the user) and was **my own stray
Playwright tab**, not a code bug.

Symptom is duplicate whispers. The writes were idempotent under the race observed (both read
the same value, both wrote the same result), but a slower interleaving *could* double-
subtract. Left undefended per 067's "Explicitly not built". The cheap fix, if it ever
matters: a roll id in the payload that the GM ignores if already applied.

### The dev environment

- `docker/docker-compose.yml:12` bind-mounts `../module` read-only into the container. Edits
  are live; **no copying, no packaging** for dev. `docker/data/Data/modules/foundry-homebrew/`
  on the host is a stale March leftover, shadowed by the mount and never read — safe to
  delete.
- The active world during this session was **`test`** (one Gamemaster), not `lost-citadel`
  (which has gamemaster/player1/player2 and is what `docker/secrets.json` names for the test
  harness).
- Foundry serves module CSS with `Cache-Control: no-store`, but a stale stylesheet still bit
  us: the user's page had current JS and two-commits-old CSS at the same time. **If positions
  look wrong, hard-reload (Cmd+Shift+R) before debugging anything.** The tell was
  `transform: matrix(1,0,0,1,0,-24)` — exactly `-50%` and no shift, which only the old file
  produces.

### Previewing UI without joining the world

**`docs/design/crawling-clock-values.html`** — committed, self-contained, opens by
double-clicking. Every value 0-20 plus the low and stirs states, from the shipped stylesheet
and the generated die at the real 180px, font embedded. A checkbox overlays the facet guides
used to fit the counter. Rebuild it with `npm run preview:clock`
(`tools/preview/crawling-clock.py`) after changing the stylesheet or the die.

Use it instead of logging in to look at something: joining as Gamemaster makes you a second
GM connection and doubles the user's whispers.

Two traps that cost a round of feedback each, now handled by that page but worth knowing if
you build another preview:

- **The font must be real.** JSL Blackletter ships with the Shadowdark system
  (`/data/Data/systems/shadowdark/fonts/JBLACK.TTF`, declared via `@font-face` in the system
  CSS). A page that cannot load it falls back to Times and misreports everything. It is
  embedded as a data URI in the committed page. Its licence allows free distribution only
  **unaltered and accompanied by `JBLACK.TXT`**, which is why that file sits beside it, and
  forbids inclusion in a commercial package.
- **Render at true size.** A 130px die when the widget ships 180px makes the type look
  better-fitted than it is.

If you do build a throwaway page: Playwright MCP **blocks `file:` URLs**, so serve it over
HTTP. `cairosvg` is unusable here — no libcairo — and the browser is the better renderer
anyway, being what Foundry uses.

### Testing

Still none, deliberately, per 067. Nothing was added this session.

### Verified behaviour

Module loads with `socket: true`; roll ticks the display and writes once; whisper carries
the persisted number; exactly one public line at 0; display clamps at 0; Reset and ± work;
a payload arriving at a client with the widget **closed** still persists and does **not**
pop the widget open; a payload from another client drives display, roll line, persistence
and whisper. The single-writer guard is the one thing **not** verified — it cannot be, with
one GM user.
