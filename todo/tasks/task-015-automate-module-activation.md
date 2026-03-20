# Task 015: Automate Module Activation

Depends on task-014. Deferred — implement when needed.

## Goal

Ensure the `foundry-homebrew` module is activated in the test world automatically, so tests don't rely on manual module management through the Foundry UI.

## Background

Currently the module must be manually enabled in Module Management for the test world. This works because it's already enabled, but is fragile — a fresh Docker `data/` directory or a new world would break the smoke test silently.

## Context

- `tests/support/global-setup.js` — from task 014, handles world launch and auth
- Foundry's Module Management API — needs research

## Research needed

- Can module activation be done via API? Likely candidate: `POST /api/setup` with `action: "updateWorld"` and a `moduleData` payload — verify against Foundry v13 build 351.
- Alternative: pre-seed `docker/data/` with a world that has the module enabled
- Alternative: use Playwright to click through Module Management UI in global setup

## Acceptance criteria

- [ ] After a clean `docker compose up`, `npm test` passes without manual module activation
- [ ] The approach is documented in `docs/TESTING.md`

## Scope boundaries

- **In scope**: automating module activation for tests
- **Out of scope**: multi-module management, CI/CD
