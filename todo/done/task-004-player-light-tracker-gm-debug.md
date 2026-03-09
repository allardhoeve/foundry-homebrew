# Task 004: Player Light Tracker — GM Debug View

Depends on task-001. Independent of tasks 002, 003, 005.

## Goal

Allow the GM to open the player light tracker for any actor via right-click context menu on the actor in the sidebar. Shows the same immersive view but includes the character name.

## Background

The GM already has the full light tracker, but for debugging and immersion testing, it's useful to see exactly what a player sees. This also enables the GM to demo the feature.

## Context

- `macros/player-light-tracker.js` — the player tracker from task 001
- Foundry `getActorDirectoryEntryContext` hook — adds right-click context menu items to actor sidebar

## Changes

### Modified: `macros/player-light-tracker.js`

- Accept an optional `actor` parameter to override `game.user.character`
- When an actor is explicitly passed, display the character name in the UI
- Register `getActorDirectoryEntryContext` hook to add "Show Light Tracker" menu item (GM only, Player-type actors only)
- Each GM-opened instance should be independent (keyed by actor ID)

## Acceptance criteria

- [ ] Right-click a Player actor in sidebar → "Show Light Tracker" option appears (GM only)
- [ ] Opens the tracker showing that actor's light state
- [ ] Character name is displayed in the UI
- [ ] Can open multiple trackers for different actors simultaneously
- [ ] Player's own tracker (via macro) is unaffected

## Scope boundaries

- **In scope**: context menu integration, actor override, name display
- **Out of scope**: any changes to the player-facing UX
