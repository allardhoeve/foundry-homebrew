# Macro Examples

This folder holds macro examples and patterns. Prefer small, focused macros
with clear comments and minimal dependencies.

## Suggested Layout
- `core/` for Foundry core API usage
- `shadowdark/` for Shadowdark system-specific macros
- `pf2e/`, `dnd5e/`, `midi-qol/` as needed

## Conventions
- Each macro file should include a short header comment describing intent and requirements.
- Prefer explicit `Hooks` usage where lifecycle matters.
- When a macro depends on a module, note the module name and version in the header.

## External Sources
Large external collections live in `third_party/` as submodules to preserve attribution and licensing.
Use those for reference rather than copying unless the license is compatible and attribution is added.
