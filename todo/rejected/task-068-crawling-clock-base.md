# Task 068: Crawling Clock — the base

Step 1 of 3. Design and rationale live in `todo/tasks/task-067-crawling-clock-mvp.md`;
read that first. Independent of other tasks.

This is the **whole working feature**, end to end, in one step: the world setting, the
socket, the roll, the GM's persistence and whisper. It is deliberately ugly. Animation,
design and packaging come after, in tasks 071 and 072.

## Goal

At the end of this task, at a real table:

- Everyone opens the widget and sees the same number, starting at 20.
- A player clicks the roll button, a d6 is rolled, and every open widget drops by that
  amount within a blink.
- The GM's client writes the new number to a world setting, so it survives a reload, a
  late join, and the widget being closed.
- The GM gets a whispered chat line per roll, so they can follow the countdown with the
  widget closed.

No animation, no theming, no launcher macro. Get it in front of the table first.

## Background

Stated by the user, and this is the base the rest is built on:

1. The counter is a **world setting** (`crawlingClockValue`), because it must persist.
2. Only the **GM** can write it. World settings are GM-writable only, and that fits: the
   GM keeps score.
3. Players roll. The result goes over a **socket** to everyone, which is what makes every
   screen move at once. The socket is the moment; the setting is the truth.
4. The GM's client also runs the socket handler, so it updates too when the widget is
   open.
5. The GM's client is the only one that writes the setting. Two players clicking at once
   producing two decrements is **accepted**, not defended against. So is a player
   under-reporting a roll, which requires editing module code.
6. The GM's client also whispers itself a line per roll, because the GM may well have the
   widget closed.

## Context

- `module/src/scarlet-minotaur-encounter.js` — the ApplicationV2 idioms to follow:
  `DEFAULT_OPTIONS`, `toggleInterface()`, `_renderHTML`/`_replaceHTML`/`_onRender`,
  settings registered in `Hooks.once("init")`, app exposed on `module.api` (`:471-495`).
- `module/src/player-light-tracker.js` — useful reference, but see the first pitfall: its
  hook registration around render state is the **wrong** pattern here.
- `module/styles/scarlet-minotaur.css` — CSS conventions (`@layer modules`, class-based).
- `docs/ui-design-guide.md` — shared UI conventions (required by CLAUDE.md).
- `game.users.activeGM` — Foundry's designated single active GM.
- This is the module's first socket feature; there is no existing pattern to copy.

## Changes

### New: `module/src/crawling-clock.js`

Everything lives here: settings, socket handler, widget.

**Settings**, registered in `Hooks.once("init")`, namespace `"foundry-homebrew"`:

- `crawlingClockValue` — Number, scope `world`, `config: false`, default 20. The truth.
  `onChange` → if the widget is rendered, repaint it with the new value.
- `crawlingClockDie` — String, scope `world`, `config: true`, default `"1d6"`.

The clock always starts at 20 and that is a constant, not a setting: it is a d20.

**Socket**: channel `"module.foundry-homebrew"`, payload
`{ action: "roll", rolled, userId }`.

`userId` is the roller. Socket messages carry no sender identity, so it has to be
explicit; the GM resolves the name from it for the whisper.

**Handler**, registered **once at module scope** in `Hooks.once("ready")`. Two halves,
both of which run on every client that receives the payload:

*Display half* — only if the widget is `rendered`:
- Set the displayed number to `max(0, displayed - rolled)`.
- Show a local "Allard rolled 4" line. Plain text, no animation.

*Persistence half* — only if `game.users.activeGM === game.user`:
- Read `crawlingClockValue`, compute `Math.max(0, current - rolled)`, write it back.
- Create a chat message whispered to the GM themselves: "Allard rolled 4. Clock: 14."
  The GM writes this line rather than the roller, so the number logged is the persisted
  truth and only one client ever creates it.
- If the new value is 0, also post one **public** chat message ("The dungeon stirs.").
  One writer, so no duplicates. This is the only thing in the feature that has to reach
  someone who is not looking at the widget, and it is one line of code, so it is in the
  base rather than in the polish task.

The persistence half must run whether or not the GM's widget is open. Nothing in it may
be reachable from the Application class.

**Application**: `CrawlingClockApp extends foundry.applications.api.ApplicationV2`.

- The current value from `crawlingClockValue`.
- A roll button, visible to everyone, label derived from `crawlingClockDie` (for example
  `Roll 1d6`), not hardcoded. Click handler:
  1. Evaluate `new Roll(die)`.
  2. Build the payload.
  3. Emit it.
  4. Call the handler locally with the same payload. Sockets do not loop back to the
     sender, and this keeps one code path for everyone.
- The last-roll line.
- GM-only controls: `Reset` writes 20; `+` and `−` write `current ± 1`,
  clamped to `[0, 20]`. All three are plain setting writes; the repaint happens through
  `onChange`, not from the click handler. These buttons are the fix for any arithmetic
  mishap, which is why nothing else in this feature defends against one.
- `toggleInterface()`, mirroring the other apps in this module.
- Exposed as `module.api.crawlingClock`.
- **Does not auto-open.** Nothing calls `render()` except `toggleInterface` and the
  `rendered`-guarded `onChange` repaint.

**Reconcile**: the `onChange` repaint is authoritative. If the displayed number and the
stored value disagree, the stored value wins on the next repaint. That is how a client
that missed an emit, reloaded, or joined late self-heals.

**Explicitly not built**: roll validation, message dedupe, write serialisation, and a
no-active-GM state. If no GM is connected, nothing persists and a reload reverts the
clock. Accepted: no GM, no game.

### New: `module/styles/crawling-clock.css`

Class-based, `@layer modules`. The bare minimum to make it legible: container, the number,
the roll line, the button row. Do not spend time on design here; that is task 071.

### Modified: `module/module.json`

- `"socket": true` at the top level. Without it the module channel silently does nothing,
  with no error.
- `"src/crawling-clock.js"` appended to `esmodules`, before `src/module-ready.js` which
  must stay last.
- `"styles/crawling-clock.css"` appended to `styles`.
- **No version bump.** That happens once, in task 072.

## Tests

None. See the Testing section of task 067: a deliberate MVP-first decision.

## Verification

Dev world (`http://localhost:30000`), GM in one browser and a player in another. Open the
widget from the console, or make a world macro by hand containing the one-liner:

```js
game.modules.get("foundry-homebrew").api.crawlingClock.toggleInterface()
```

1. Both widgets show 20.
2. Player rolls → both counters drop by the same amount within a blink, and both show the
   same roll line. The roller's own screen updates exactly once.
3. The **player's** chat log stays empty. The GM's chat log shows the whispered line with
   the matching number.
4. **GM closes the widget.** Player rolls twice → the whispers still arrive with a
   correctly decreasing number. The GM's widget does **not** pop open by itself.
5. GM reopens the widget → correct current number.
6. Player reloads and reopens → correct number.
7. Player rolls with the **player's** widget closed → the GM's whisper still shows the
   decrement.
8. Drive it to 0 → the display clamps at 0 and exactly one public chat line appears.
9. GM `Reset` and `±` update every open widget.
10. Change `crawlingClockDie` in settings → the roll button's label follows.
11. The existing encounter macros still work, untouched.

Append a **Results (date):** line here after running.

## Pitfalls

- **The socket handler must live at module scope**, registered once at `ready`, never
  inside the Application's lifecycle. `player-light-tracker.js` registers and tears down
  hooks around render state; copying that here means the GM closing the widget silently
  stops the clock from persisting, a bug that only surfaces on reload. Verification step 4
  exists for this.
- **`render()` on a closed ApplicationV2 opens it.** Guard every repaint with `rendered`,
  or the widget pops open on every screen on every roll.
- Sockets do not loop back. Emit, then call your own handler with the same payload. Do not
  special-case the roller, and do not react twice on the roller's client.
- `"socket": true` must be in `module.json` or the channel silently does nothing.
- Guard the write with `game.users.activeGM === game.user` so a second connected GM cannot
  double-subtract.
- The GM's client runs both halves. The `onChange` repaint that follows its own write
  should be a no-op snap to the number the payload already painted, not a second visual
  update.
- Register the settings **before** constructing the app inside the same `init` callback,
  or reading a setting in the constructor throws "setting not registered" (see
  `player-light-tracker.js:121-122`).
- Clamp `±` so the counter cannot go negative or above 20.
- No inline CSS in the JS (CLAUDE.md).
- Sharp edge, accepted: a bad die formula typed into the settings box makes `new Roll(die)`
  throw inside the click handler. Not defended against.

## Acceptance criteria

- [ ] Widget opens only via `toggleInterface()`, never by itself
- [ ] Any user can roll; every open widget ticks down by the same amount, once
- [ ] Nothing appears in players' chat for a roll
- [ ] The GM's whisper names the roller and shows the persisted number
- [ ] The GM can keep the widget closed all session and the value still persists
- [ ] Reopening, reloading, or joining late shows the stored number
- [ ] Exactly one client writes the setting, and exactly one public line appears at 0
- [ ] GM Reset and ±1 update every open widget; the buttons are hidden for non-GMs
- [ ] Roll button label follows `crawlingClockDie`
- [ ] `"socket": true` in `module.json`; no version bump
- [ ] No inline CSS in the JS
- [ ] Existing encounter macros untouched and still working

## Scope boundaries

- **In scope**: settings, the window, the number, the roll button, the socket, the GM's
  persistence and whisper, the public line at 0, GM Reset and ±, minimal CSS, wiring into
  `module.json`.
- **Out of scope**: die animation, the low and stirs states, sound, any real design work
  (task 071); the launcher macro and the version bump (task 072).
- **Do not** add roll validation, message dedupe, write serialisation, or a no-active-GM
  UI state. See task 067, "Explicitly not built".
- **Do not** resolve encounters in the widget, modify the existing encounter macros, or
  auto-open the widget.
