# Foundry VTT API Notes

Last updated: 2026-02-04

This document summarizes core references for building macros and modules. For definitive
interfaces, always consult the official API docs.

## Official References
- API Index (v13): https://foundryvtt.com/api/v13/index.html
- ApplicationV2: https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html
- Hooks: https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html
- Macro Commands: https://foundryvtt.com/article/macros/
- Macro Document: https://foundryvtt.com/api/v13/classes/foundry.documents.Macro.html

## Working Assumptions
- Default target is Foundry VTT v13 build 351 unless otherwise specified.
- Prefer public APIs listed in the official docs over undocumented globals.

## Macro Usage Notes
- Macros run in the client context and can access Foundry globals (e.g., `game`, `ui`, `canvas`).
- Use Hooks to integrate with application lifecycle and game events.
- Store reusable patterns here as examples in `examples/macros/` and reference the API docs above.

## UI / ApplicationV2 Notes
- ApplicationV2 is the modern base for custom UI. Favor it over legacy `Application` for new work.
- When a macro needs a UI, use ApplicationV2 and register appropriate hooks for lifecycle events.

## Hooks Notes
- Hooks are the primary integration mechanism for modular behaviors.
- Prefer `Hooks.once` for one-time setup and `Hooks.on` for recurring callbacks.
