# Task 019: GM results panel for encounter roller

Depends on task-019-gm-agency-chat-css and task-019-gm-agency-reachable-math.

## Goal

When an encounter is rolled, show a results panel in the app window instead of immediately posting to chat. The GM reviews the result, can override the encounter selection, and chooses to post to chat or dismiss silently.

## Background

The encounter roller currently auto-broadcasts results, removing GM agency. The GM can't fudge rolls, delay encounters, or choose how to communicate. This task adds a third render mode (results panel) that intercepts the encounter table result and gives the GM control.

See the full plan at `.claude/plans/sleepy-zooming-catmull.md` for UI mockup and design rationale.

## Context

- `module/src/scarlet-minotaur-encounter.js` — main app, currently has two render modes (picker, roller)
- `module/src/encounter-math.js` — `ENCOUNTERS` array, `resolveEncounter()`, `getReachableRange()` (added by prior task)
- `module/styles/scarlet-minotaur.css` — app styles + chat message classes (cleaned up by prior task)
- `docs/ui-design-guide.md` — dark background, parchment text, blackletter titles, button tiers

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| When does penalty update? | On action (post or dismiss), not when panel opens |
| What does Dismiss do to penalty? | Still increments — encounter happened mechanically |
| Can GM pick unreachable entries? | Yes, all 8 clickable, unreachable ones visually muted |
| Does Minotaur selection get dramatic treatment? | Yes, if GM selects entry 1 (even via override) |

## Changes

### Modified: `module/src/scarlet-minotaur-encounter.js`

**New state:**
- `_pendingEncounter` — object holding roll data when results panel is showing: `{ rawD8, adjustedResult, penalty, selectedIndex, checkDie, checkLabel, checkResult }`

**New render mode:**
- `_renderResults()` — builds the results panel DOM:
  - Blackletter title "Encounter Rolled"
  - Roll info line: "Your roll: X (adjusted: Y) | Penalty: -Z"
  - Encounter list: all 8 entries, each a clickable row with index number and text
  - Selected row highlighted (amber background), unreachable rows muted (dimmer text via `getReachableRange`)
  - Action buttons: "Post to Chat" (primary), "Dismiss" (secondary)
  - Penalty selector (same as roller view)

**Modified `_renderHTML`:**
- Add third branch: if `_pendingEncounter` exists, call `_renderResults()`

**Modified `_rollEncounterTable`:**
- Instead of calling `_postMinotaurEncounter`/`_postEncounter`/`_postDebugInfo`, store roll data in `_pendingEncounter` and call `this.render()`

**New `_onRender` logic for results panel:**
- Encounter row click → update `_pendingEncounter.selectedIndex`, re-render
- "Post to Chat" click → update penalty, post selected encounter to chat (Minotaur or standard), post debug whisper, clear `_pendingEncounter`, re-render
- "Dismiss" click → update penalty, clear `_pendingEncounter`, re-render
- Penalty selector change → same as today

### Modified: `module/styles/scarlet-minotaur.css`

Add results panel styles:

- `.sme-results-info` — roll info line (small, muted text)
- `.sme-encounter-list` — container for the 8 encounter rows
- `.sme-encounter-row` — individual encounter option (clickable, padding, border-bottom)
- `.sme-encounter-row:hover` — subtle highlight
- `.sme-encounter-row--selected` — amber background highlight for current selection
- `.sme-encounter-row--unreachable` — muted text for penalty-impossible entries
- `.sme-encounter-row__index` — the number (1-8)
- `.sme-encounter-row__text` — the encounter description (truncated with ellipsis for long text)
- `.sme-action-buttons` — flex container for Post/Dismiss buttons

## Verification

Manual testing in Foundry (use "1 — Roll an encounter now" debug button for quick iteration):

1. Click roll → encounter triggered → results panel appears with rolled result highlighted
2. Click a different row → selection changes, previous deselected
3. Click unreachable row → still works, selection changes
4. "Post to Chat" → public message appears, debug whisper appears, penalty updates, panel returns to roller
5. "Dismiss" → no chat message, penalty still updates, panel returns to roller
6. Select Minotaur (entry 1) → "Post to Chat" → dramatic Minotaur message appears
7. Penalty selector still works during review

## Pitfalls

- The `_onRender` method now needs to handle three modes (picker, roller, results). Keep the branching clean.
- Penalty update must happen on action, not on panel open — otherwise dismissing would double-count.
- The `_pendingEncounter.selectedIndex` is 1-based (matches encounter table), not 0-based.

## Acceptance criteria

- [ ] Rolling an encounter shows the results panel instead of posting to chat
- [ ] All 8 encounters are listed, rolled result is pre-selected
- [ ] Unreachable entries are visually muted but clickable
- [ ] GM can change selection by clicking a different row
- [ ] "Post to Chat" posts the selected encounter with correct styling (Minotaur vs standard)
- [ ] "Post to Chat" posts a debug whisper with roll breakdown
- [ ] "Dismiss" returns to roller without posting
- [ ] Penalty increments correctly on both Post and Dismiss
- [ ] Penalty resets to 0 if Minotaur is selected and posted
- [ ] Existing picker and roller modes still work

## Scope boundaries

- **In scope**: Results panel UI, encounter override, post/dismiss actions, penalty management
- **Out of scope**: Distance, activity, reaction, treasure sub-rolls (Phase 2)
- **Do not** change the no-encounter whisper flow
