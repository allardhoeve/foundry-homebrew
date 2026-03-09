# Task 005: Player Light Tracker — Multi-Character Support

Depends on task-001. Independent of tasks 002, 003, 004.

## Goal

Support players who own multiple characters or have been assigned NPCs by the GM. Allow selecting which character's light to track.

## Background

GMs often assign NPCs to players so they can see and move them. `game.user.character` returns the primary character, but a player may want to track light for a different owned actor.

## Context

- `macros/player-light-tracker.js` — scaffold from task 001 uses `game.user.character`
- `game.actors.filter(a => a.isOwner && a.type === "Player")` — finds all player-owned actors

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Default actor | `game.user.character` (unchanged from task 001) |
| Actor switching | Small dropdown or icon row if player owns multiple Player-type actors |
| NPC filtering | Only show actors of type `"Player"`, not assigned NPCs |

## Changes

### Modified: `macros/player-light-tracker.js`

- On render, check if player owns multiple Player-type actors
- If yes, show a character selector (small portraits or dropdown)
- Selected character persists for the session (no need for permanent storage)
- Hooks re-register for the newly selected actor on switch

## Acceptance criteria

- [ ] Single-character players see no selector (unchanged behavior)
- [ ] Multi-character players see a selector
- [ ] Switching characters updates the light display immediately
- [ ] Hooks correctly track the selected character, not all owned actors

## Scope boundaries

- **In scope**: actor selection UI, hook re-registration
- **Out of scope**: NPC tracking, GM-assigned actor tracking
