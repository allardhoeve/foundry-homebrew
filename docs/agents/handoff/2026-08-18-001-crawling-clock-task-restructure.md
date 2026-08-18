# 2026-08-18 — Crawling Clock: task restructure

Planning-only session. **No module code was written.** The work was restructuring the
Crawling Clock task files so the feature gets built as one working thing first, then made
to look good.

## What was accomplished

### Collapsed a five-step build order into three

The Crawling Clock was planned as tasks 068-072: widget shell → roll broadcast → GM
persistence → feel → packaging. The user rejected that order. Two of the first three steps
ended in a half-feature nobody could play, and the design only proves itself once the
socket and the GM write are both in.

Now:

1. **task-068-crawling-clock-base** — the complete feature, end to end, deliberately ugly
2. **task-071-crawling-clock-feel** — animation, states, sound, the design pass
3. **task-072-crawling-clock-packaging** — macro, `macros.json`, version bump

### Files changed

| File | What |
|------|------|
| `todo/tasks/task-068-crawling-clock-base.md` | **New.** The whole base: settings, widget, roll button, socket, GM persistence and whisper. |
| `todo/tasks/task-068-crawling-clock-widget-shell.md` | **Deleted**, absorbed into 068. |
| `todo/tasks/task-069-crawling-clock-roll-broadcast.md` | **Deleted**, absorbed into 068. |
| `todo/tasks/task-070-crawling-clock-gm-persistence.md` | **Deleted**, absorbed into 068. |
| `todo/tasks/task-067-crawling-clock-mvp.md` | Build order rewritten; records why the old split was wrong so the reasoning is not lost. Base payload corrected. |
| `todo/tasks/task-071-crawling-clock-feel.md` | Now step 2 of 3, depends on 068. Owns `seed`, the low glow, and the design pass. No longer posts the public zero message. |
| `todo/tasks/task-072-crawling-clock-packaging.md` | Step 3 of 3. Header and version-bump wording only. |

All of these were **untracked** at session start (`??` in git status), so nothing
committed was deleted. Nothing was committed this session either — the working tree still
has them untracked, alongside a stray `d1.png` that predates this session.

## Key decisions

### The base is built whole, not in slices

The driving principle, stated by the user: build the final very first version, get it in
front of the table, *then* embellish. Slicing along technical seams (UI, then transport,
then persistence) produced steps that were demoable but not playable.

### Concerns for later must not leak backwards into the base

The user caught this twice, and it is the thing a future agent is most likely to
re-introduce. Three items were stripped from task 068:

- **`seed`** in the socket payload. It exists only so every client's die tumbles through
  the same face sequence. It was originally carried in the base "so the payload shape does
  not change again" — which is exactly the leak. Task 071 adds it when there is something
  to animate. Base payload is `{ action, rolled, userId }`.
- **"in its own element with its own class so the d20 SVG can slot in later"** —
  pre-structuring markup for a shape that is not in scope.
- **"Give the panel a fixed height now, so the states added in task 071 never resize the
  window"** — 071's problem. 071 already establishes it.

If you find yourself justifying something in task 068 with "so that task 071 can…", cut it.

### What stayed in the base, deliberately

The public `"The dungeon stirs."` chat line at 0. It is one line, and without it nothing
marks the moment the clock runs out except a number sitting at 0. Flagged to the user as
the one remaining judgment call of this kind; they did not ask for it to move, but it is
the obvious candidate if the base is trimmed further.

### `seed` is optional at all

Task 071 now says so outright: if nobody at the table can see anyone else's screen, drop
it and derive the tumble from `rolled`. The cost of dropping it is that every 4 ever
rolled animates identically.

## Important context for future sessions

### The design of record

`todo/tasks/task-067-crawling-clock-mvp.md` is the whole-feature design and rationale. It
is **not implemented directly**. Read it before touching 068/071/072. Its Roles table (the
setting is the truth, the socket is the moment, the whisper is awareness not transport) is
the load-bearing part.

### The user's own framing of the base

Worth preserving because it is why the design is shaped this way:

1. World setting for the counter, starts at 20 — it must persist.
2. The GM keeps score, because a world setting is GM-writable only.
3. Players roll; the result goes over a socket to everyone.
4. The GM's client animates too, if their widget is open.
5. The GM's client is the only writer. Two players clicking at once producing two
   decrements is **accepted**, not defended against.
6. The GM's client also whispers itself the result, because the GM may have the widget
   closed.

### Traps that are documented but easy to hit anyway

- The socket handler must live at **module scope**, registered once at `ready`. Putting it
  in the Application lifecycle (as `player-light-tracker.js` does with its hooks) means the
  GM closing the widget silently stops persistence — a bug that only surfaces on reload.
  Verification step 4 in task 068 exists purely to catch this.
- `render()` on a closed ApplicationV2 **opens** it. Guard every repaint with `rendered`.
- Sockets do not loop back to the sender. Emit, then call your own handler with the same
  payload. Do not react twice on the roller's client.
- `"socket": true` must be in `module.json` or the channel silently does nothing, with no
  error.
- Register settings before constructing the app in the same `init` callback.

### Testing

Deliberately none across all three tasks. A stated deviation from CLAUDE.md's testing
policy, recorded in task 067's Testing section along with what to write if tests come back
later. Task 067 also corrects an earlier assumption: multi-client BDD *is* possible — the
harness saves storageState for gamemaster, player1 and player2 — the only blocker is the
single-slot `session` fixture in `tests/support/fixtures.js:16-25`.

### Version bumps

Exactly one, in task 072, at the very end. Tags are never deleted or moved.

### Not started

No file under `module/` has been touched. `module/src/crawling-clock.js`,
`module/styles/crawling-clock.css` and `module/macros/crawling-clock-macro.js` do not
exist yet. Next action is implementing task 068.
