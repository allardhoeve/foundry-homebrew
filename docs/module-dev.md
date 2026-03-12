# Module Development Notes

Last updated: 2026-02-04

This document summarizes official guidance for modules and packaging.

## Official References
- Module Development: https://foundryvtt.com/article/module-development/
- Content Packaging Guide: https://foundryvtt.com/article/packaging-guide/
- System Development: https://foundryvtt.com/article/system-development/

## Minimal Module Structure (Typical)
- `module.json` (manifest)
- `src/` (module JS)
- `styles/` (optional CSS)
- `templates/` (optional Handlebars)
- `packs/` (optional compendium content)

## Notes
- Always confirm manifest schema and version requirements in the official docs.
- Keep module code in `src/` and expose a clean API via `game.modules.get(id)` when needed.
- Use `Hooks` for setup and ready lifecycle phases.
