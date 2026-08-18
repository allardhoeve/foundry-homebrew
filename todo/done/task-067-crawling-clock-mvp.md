# Task 067: The Crawling Clock (MVP)

Design and rationale for the whole feature. **Not implemented directly** — the work is
split across tasks 068, 071 and 072, listed under Build order. Read this first, then the
step you are on.

Independent of other tasks. New, self-contained feature: it does not replace or touch the
existing encounter macros.

## Goal

A shared, player-visible dungeon timer. A counter starts at 20 and is displayed as a
d20. Each round a player rolls a d6, the die animates on every screen, and the result
is subtracted from the counter. When it reaches 0, the dungeon stirs. The GM then
handles the actual encounter (d8 + placement) however they normally do. This widget
does not resolve encounters.

## Background

The current encounter cadence is a hidden per-round roll (`random-encounter-check.js`,
`scarlet-minotaur-encounter.js`) with an invisible ~1/12 probability. It brings no
tension to the table: players can't feel time running out. The Crawling Clock offers a
bounded, visible countdown instead.

Established during design:
- **Self-contained.** The existing encounter macros stay exactly as they are. No
  deprecation, no rewiring, no integration button.
- **No flavour text.** The old roller's grimdark message arrays exist to dress up
  information it deliberately hid. This widget shows the roll and the number, so it
  needs no mood text.
- **No auto-open.** Opened from a macro. (The Shadowdark light tracker auto-opens and
  it's annoying.)
- **Suspense over paper trail.** Rolls do not go to public chat. The table watches the
  widget. Only the zero moment is announced publicly.
- **No tests in this task.** Deliberate, MVP first. See Testing.

### Pacing note

20 minus 1d6 averages ~5.7 rounds per cycle, bounded to 4-20, and an encounter is
*guaranteed* within 20. The old hidden check was ~1/12 per round (expected 12,
unbounded). So the default roughly doubles encounter frequency. That's why the start
value and die are GM-editable from day one.

## The design in one paragraph

The world setting is the **truth**. The socket message is the **moment**. A player
clicks, their client rolls and emits `{ rolled, seed }` to everyone, and every client
animates the die and ticks its counter down immediately. Nobody waits on a database
write. In parallel the single active GM's client writes the new number to the world
setting and whispers itself a log line. Anything that misses an emit (widget closed,
reload, late join) self-heals by snapping to the stored number when it next renders.

## Roles

| Piece | Role |
|-------|------|
| `crawlingClockValue` world setting | The truth. Written only by the active GM. |
| Socket payload `{ rolled, seed }` | The live moment. Ephemeral, best-effort, drives animation on every client. |
| GM whisper per roll | The GM's awareness feed so they can follow the countdown with the widget closed. Not transport. |
| Public chat line at zero | The only thing that has to reach someone who isn't looking at the widget. |
| The widget | A view. It owns no state and no persistence. |

`seed` is a shared random value so every client's die tumbles through the same face
sequence before landing. Pure polish; the feature works without it, and it does not exist
until there is an animation to drive, in task 071. The base payload is
`{ action, rolled, userId }`.

## Context

- `module/src/scarlet-minotaur-encounter.js` — ApplicationV2 idioms in this codebase:
  `_renderHTML`/`_replaceHTML`/`_onRender`, settings registered in `Hooks.once("init")`,
  `toggleInterface()`, app exposed on `module.api` (see `:471-495`).
- `module/src/player-light-tracker.js` — useful reference, but see the first pitfall:
  its `_registerHooks`/`_unregisterHooks` around render state is the **wrong** pattern
  for this feature.
- `module/macros/player-light-tracker-macro.js` + `module/macros/macros.json` — the
  launcher-macro pattern (one-liner calling `toggleInterface()`).
- `module/styles/scarlet-minotaur.css` — CSS conventions (`@layer modules`, class-based,
  `!important` only to override Foundry base styles).
- `docs/ui-design-guide.md` — shared UI conventions (required by CLAUDE.md).

## Constraints

- No inline CSS in JS. V2 Application framework only. No Foundry private/underscore
  internals.
- World-scoped settings can only be written by a GM client.

## Changes

### New: `module/src/crawling-clock.js`

Everything lives here: settings, socket handler, widget.

**Settings** (`Hooks.once("init")`, namespace `"foundry-homebrew"`):
- `crawlingClockValue` — Number, scope `world`, `config: false`, default 20. The truth.
  `onChange` → if the widget is rendered, snap the display to the new value (no
  animation; this is the reconcile path, not the live path).
- `crawlingClockDie` — String, scope `world`, `config: true`, default `"1d6"`.

The clock always starts at 20 and that is a constant, not a setting: it is a d20, so any
other number would make the die drawn on the widget a lie. The die that decrements it is
the thing worth changing.

**Socket** (`module.json` needs `"socket": true`): channel `"module.foundry-homebrew"`,
payload `{ action: "roll", rolled, seed }`.

**Roll flow**:
1. Any user clicks the roll button. Their client evaluates `new Roll(die)`.
2. Emit `{ rolled, seed }`, then call the handler locally with the same payload.
   Sockets do not loop back to the sender, so this is what keeps one code path.
3. Every client's handler runs:
   - If the widget is rendered: animate the die landing on `rolled`, then tick the
     counter down from the number it last painted. If a new payload arrives mid-
     animation, snap the current one to its end and start the new one.
   - If this client is the active GM: compute `Math.max(0, current - rolled)`, write it
     to `crawlingClockValue`, then whisper itself a line
     ("Allard rolled 4. Clock: 14."). The GM writes the line, not the roller, so the
     number logged is the persisted truth.
   - If the new value is 0, the active GM also posts a **public** chat message ("The
     dungeon stirs.") and every client plays the zero state plus a sound.

**GM controls** (GMs only): `Reset` writes 20; `+` / `−` write
`current ± 1`. Both are plain setting writes and repaint everyone via `onChange`. The
adjust buttons are the fix for any arithmetic mishap, which is why nothing else in this
feature defends against one.

**States**:
- *Ready* — the number, the roll button (label derived from `crawlingClockDie`), a local
  "Allard rolled 4" line from the last payload, GM controls.
- *Low* — `.crawling-clock--low` at value ≤ 6 for a tension glow.
- *Zero* — `.crawling-clock--stirs`, roll disabled, prominent GM `Reset`.

**API**: expose `module.api.crawlingClock` with `toggleInterface()`.

**Explicitly not built**: roll validation, message dedupe, write serialisation, and a
no-active-GM state. Five people at one table cannot produce the conditions those guard
against, and where they can, the visible failure plus the ± buttons is the fix. If the
GM is offline nothing persists and a reload reverts the clock: no GM, no game.

### New: `module/styles/crawling-clock.css`

Class-based, `@layer modules`. Container, the big number, the die, the roll line, the
button row, `--low`, `--stirs`. Give every state the **same fixed height** so the panel
never needs to resize and the number never jumps.

### New: `module/macros/crawling-clock-macro.js`

```js
game.modules.get("foundry-homebrew").api.crawlingClock.toggleInterface();
```

### Modified: `module/macros/macros.json`

Add an entry: fresh 16-char id, name "The Crawling Clock", file path, icon from
`assets/images/`.

### Modified: `module/module.json`

- `"socket": true`.
- `"src/crawling-clock.js"` appended to `esmodules`, before `src/module-ready.js` which
  must stay last.
- `"styles/crawling-clock.css"` appended to `styles`.
- Bump `version` **once, at the very end**. Tags are never deleted or moved.

## Build order

The base is built whole, in one step, and put in front of the table before anything is
made to look good. Only then is it embellished.

1. **task-068-crawling-clock-base** — settings, the widget, the roll button, the socket,
   the GM's persistence and whisper, the public line at 0. The complete feature, working
   end to end and deliberately ugly. Launch it from the console.
2. **task-071-crawling-clock-feel** — die animation, the low and stirs states, sound, the
   design pass. The part worth building.
3. **task-072-crawling-clock-packaging** — macro file, `macros.json`, version bump.

An earlier plan split step 1 across three tasks (shell → broadcast → persistence). That
was the wrong order: two of the three ended in a half-feature that could not be played,
and the design only proves itself once the socket and the GM write are both in. Those
tasks are gone; their content is in task 068.

During steps 1-2, make a world macro by hand containing the one-liner rather than
rebuilding the macro pack each time. A macro already on the hotbar keeps its old command
and does not follow the compendium.

## Testing

**None in this task, by decision.** MVP first, get it in front of the table before
locking behaviour down. A deliberate deviation from CLAUDE.md's testing policy.

If tests come back later: the arithmetic is one line and trivially extractable; the
interesting cases are "non-GM does not write" and "active GM writes exactly once".
Multi-client BDD *is* possible, contrary to earlier assumptions: the harness saves
storageState for gamemaster, player1 and player2 (`tests/support/global-setup.js`) and
the login step builds a fresh context per call (`tests/steps/common.steps.js:27`). The
only blocker is the single-slot `session` fixture (`tests/support/fixtures.js:16-25`),
which a second login clobbers. Any feature file added later must be tagged
`@mode:serial` and reset the world setting in `Background`.

## Verification

Manual, dev world (`http://localhost:30000`), GM in one browser and a player in another:

1. Both open the widget from the macro and see the same number.
2. Player rolls → the die animates on **both** screens and both counters drop by the
   same amount. Nothing appears in the player's chat log.
3. GM's chat log shows the whispered line with the correct running number.
4. **GM closes the widget**, player rolls again → GM's whisper still arrives, and
   reopening the widget shows the correct number. The widget must **not** pop open by
   itself at any point.
5. Player reloads mid-session → widget reopens (from the macro) on the correct number.
6. Drive it to 0 → zero state and sound on both screens, public chat line appears.
7. GM `Reset` and `±` update both screens.
8. Change `crawlingClockDie` in settings → the roll button's label follows.

**Results (2026-08-18):** built directly from this task; 068, 071 and 072 were rejected
as separate steps and their content folded in here as it was needed. Delivered: the whole
base, the launcher macro, the d20 artwork and the low and stirs states. **Not** built: the
die animation and the zero sound. No version bump either — `.github/workflows/release.yml`
stamps the version from the git tag, so a manual bump would only be overwritten.

The die is generated by `tools/d20/generate-d20.py`, which computes a real icosahedron and
hatches the ten visible facets, leaving the centre one bare for the counter. The artwork is
ours; a reference image found during design was someone else's and was not used.

The counter uses JSL Blackletter, whose old-style figures put every number on a shared
baseline but leave the *ink* off-centre by up to a quarter of the type size — 5 hung out of
the facet, 8 rode high. Because the clock only ever shows 0-20, each value gets its own
class and the stylesheet places it individually: ink box measured from the font, centred on
the facet's centroid, sized to keep clearance from the base and the sloping sides. Twenty
of the twenty-one share one size; 14 and 20 were then hand-tuned smaller and 17 lowered.

Two things learned there, both recorded above the table in `crawling-clock.css`. The facet
narrows towards the apex, so raising a number costs it size — the centroid is the highest
position that keeps the set at one size. And the shifts are `em`, so they are tied to the
size on the same line: changing one without recomputing the other lets the number drift.

An intermediate attempt grouped the numbers into six typographic buckets. It was abandoned
once the maximum became fixed, and it had been positioned against a target derived on the
wrong assumption that the text baseline sits at the centre of its line box. It does not,
which is why that version sat low.

Verified in the dev world: module loads with `socket: true`; roll ticks the display and
writes the setting once; whisper carries the persisted number; public line at 0 appears
exactly once; display clamps at 0 and shows a plain "The dungeon stirs." line; Reset and
± work; a payload arriving at a client with the widget **closed** still persists and does
not pop the widget open; a payload from another client drives display, roll line,
persistence and whisper.

Found while testing: the `game.users.activeGM === game.user` guard compares User
documents, so it does not distinguish **two connections of the same GM user** (two tabs,
or a laptop and a tablet). Every such connection passes the guard and writes its own
whisper. Duplicate whispers are the usual symptom; the writes were idempotent under a
race here (both read the same value and wrote the same result), but a slower interleaving
could double-subtract. Left undefended, per "Explicitly not built". A roll id in the
payload, ignored by the GM if already applied, is the cheap fix if it ever matters.

## Notes for the parts that were not built

### The sound at zero

Chosen but **not yet in the repo**:
<https://freesound.org/people/Gamufreaku/sounds/655238/>

- "Dice Rolling.wav" by **Gamufreaku**, **CC BY 4.0**, 2:24.905, wav.
- Only the **first second is useful** — that is the die landing on wood. The rest is
  shaking and further rolls. Trim before shipping it.

The licence is attribution, so crediting is a condition of use, not a courtesy. Add the
credit **at the same time as the audio file**, not before — `LICENSE` is currently plain
MIT with no third-party section, and crediting an asset that is not in the repo would be
its own kind of wrong. When it lands, `LICENSE` needs a third-party section naming the
title, the author, the licence and the URL.

Note the parallel with the die: this is the second external asset considered for this
feature. The first was someone else's illustration and was dropped. This one is usable
precisely because its licence says so.

### Seeing the widget without joining the world

**`docs/design/crawling-clock-values.html`** — every value 0-20 plus the low and stirs
states, drawn from the shipped stylesheet and the generated die at the real 180px, with
the font embedded. Open it directly; no server, no Foundry, no build step. A checkbox
overlays the die's centre facet in red and the target ink centre in blue, which is how the
counter's fitting was judged and the fastest way to tell whether a number is off-centre or
simply too big for the plate.

Reach for it rather than logging in to look at something: a second connection as the same
GM user defeats the `activeGM` guard and doubles the whispers while you are in there.

`tools/preview/crawling-clock.py` (`npm run preview:clock`) rebuilds the page after the
stylesheet or the die changes. The page is the artefact; the script only refreshes it.

Two traps it now avoids, both of which cost a round of misdirected feedback during this
task: a preview whose font silently fell back to Times, and one drawn at a 130px die when
the widget ships 180px. Anything rendered smaller than true size misreports the type's fit.

`JBLACK.TXT` sits beside the page and must stay there. JSL Blackletter is Jeffrey S. Lee's,
distributable only unaltered and accompanied by that readme, and not in a commercial
package.

## Pitfalls

- **The persistence listener must live at module scope**, registered once at `ready`,
  never inside the Application's lifecycle. `player-light-tracker.js` registers and
  tears down its hooks around render state, and copying that here means the GM closing
  the widget silently stops the clock from persisting: a bug that only surfaces on
  reload.
- **`render()` on a closed ApplicationV2 opens it.** Guard every repaint with
  `rendered`, or the widget pops open on every screen on every roll.
- Sockets do not loop back. Emit, then call your own handler with the same payload.
- `"socket": true` must be in `module.json` or the channel silently does nothing.
- Guard the write with `game.users.activeGM === game.user` so a second connected GM
  can't double-subtract.
- Register settings **before** constructing the app in the same `init` callback, or you
  get a "setting not registered" throw (see `player-light-tracker.js:121-122`).
- The roller must not animate on click and again on the payload. One trigger only.
- Sharp edge, accepted: a bad die formula typed into the settings box makes
  `new Roll(die)` throw inside the click handler. Not defended against.

## Acceptance criteria

Two items were deliberately not built and are marked as such.

- [x] Widget opens from the macro (and `toggleInterface()`), never by itself
- [x] A player's roll ticks the counter on every open widget
- [ ] The die animates on a roll — **not built**
- [x] Nothing appears in players' chat for a roll; the GM gets a whispered line with the
      persisted number
- [x] The GM can keep the widget closed all session and the value still persists
      correctly
- [x] Reopening, reloading, or joining late shows the stored number
- [x] Zero state on every client — the die turns, the roll is disabled and one public
      chat line is posted
- [ ] A sound at zero — **not built**
- [x] GM Reset and ±1 update every screen
- [x] Die editable in settings; roll button label follows it
- [x] The counter is optically centred on the die's facet for every value
- [x] Existing encounter macros untouched and still working
- [x] No inline CSS in the JS

## Scope boundaries

- **Out of scope (→ a follow-up polish task, not yet written)**: richer zero-state
  animation, in-widget UI for the die, Dice So Nice integration and a Shadowdark theme.
- **Out of scope (→ v3 idea)**: danger presets ("deadly / risky / unsafe") that pick a
  die, so the GM picks a mood instead of tuning a formula.
- **Out of scope (later, if the feature sticks)**: unit tests, multi-client BDD via a
  multi-session fixture.
- **Do not**: resolve encounters in the widget (no d8/placement/table); modify or
  deprecate the existing encounter macros; copy the Minotaur penalty machinery or its
  inline CSS; auto-open the widget.
- **Not modelled**: rounds. Nothing stops the same player rolling twice. The visible
  roll plus the GM ± buttons is the mitigation. Cheating is possible by under-reporting
  a roll, which requires editing module code and shows up as a suspicious run of low
  numbers. Not defended against.
