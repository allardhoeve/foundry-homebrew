# Task 003: Player Light Tracker — Animations & Visual Polish

Depends on task-001.

## Goal

Add visual animations and polish to the light tracker: flickering effects for fading light, a dramatic darkness transition, and the user-provided animation asset.

## Background

The scaffold (task 001) includes a `<div class="light-animation">` placeholder. This task fills it with actual visual content. The user has a specific animation in mind that they will provide.

## Context

- `macros/player-light-tracker.js` — scaffold with animation placeholder from task 001
- https://www.torchlighttimer.com/ — visual inspiration (dark, atmospheric)

## Available Assets

Downloaded from https://www.torchlighttimer.com/ into `assets/`:

### Video (`assets/video/`)

Torch lifecycle: `ignite.mp4` → `yellow.mp4` → `orange.mp4` → `red.mp4` → `extinguish.mp4` → `darkness.mp4`

Spell lifecycle: `staffIgnite.mp4` → `staff.mp4` (loop) → `staffExtinguish.mp4`

### Audio (`assets/audio/`)

`torchSound.wav`, `staffGlowSound.wav`, `torchEndSound.wav`

### Macro images (planned)

`minotaur.png`, `minotaur-dark.png`

See `assets/README.md` for full details.

## Changes

### Modified: `macros/player-light-tracker.js`

- CSS animations for state transitions (e.g., fade between states)
- Visual treatment per state:
  - **Bright**: warm glow / steady light — use `yellow.mp4`
  - **Good**: slightly dimmer — use `orange.mp4`
  - **Fading**: flickering — use `red.mp4`
  - **Darkness**: use `darkness.mp4` (with `extinguish.mp4` transition)
- Spell variant: `staffIgnite.mp4` → `staff.mp4` → `staffExtinguish.mp4`
- Smooth transitions between states (CSS transition on background, opacity, etc.)

### Assets directory: `assets/video/`, `assets/audio/`

MP4 video animations and WAV sound effects (already downloaded).

## Acceptance criteria

- [x] Each light state has a distinct visual treatment
- [x] Transitions between states are smooth
- [x] Darkness state displays the provided animation
- [x] No performance issues (CSS animations preferred over JS)

## Scope boundaries

- **In scope**: visual animations, CSS effects, asset integration
- **Out of scope**: functionality changes, new features
