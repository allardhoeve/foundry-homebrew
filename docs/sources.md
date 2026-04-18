# Foundry VTT Sources (Curated)

Last updated: 2026-02-04

This file is a curated, ranked list of sources for Foundry VTT macros, modules, and API usage.
The goal is to prioritize authoritative references first, then high-signal community examples,
while flagging sources that are likely outdated or system-specific.

## Ranking Legend
- A: Official, authoritative, and versioned
- B: Community-run, curated, but mixed quality or system-specific
- C: Useful examples, but inconsistent, outdated, or narrowly scoped

## A — Official References
- Foundry VTT API (v14 index)
  - URL: https://foundryvtt.com/api/v14/index.html
  - Notes: Versioned API index and guidance on public vs private API usage.

- ApplicationV2 API
  - URL: https://foundryvtt.com/api/v14/classes/foundry.applications.api.ApplicationV2.html
  - Notes: Modern application class for UI and rendering.

- Hooks API
  - URL: https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html
  - Notes: Core event system for module/macro integration.

- Macro Commands Guide
  - URL: https://foundryvtt.com/article/macros/
  - Notes: Official macro usage, types, and best practices.

- Macro Document API
  - URL: https://foundryvtt.com/api/v14/classes/foundry.documents.Macro.html
  - Notes: Macro document fields and creation patterns.

- Module Development Guide
  - URL: https://foundryvtt.com/article/module-development/
  - Notes: Manifest format, module structure, and packaging requirements.

- System Development Guide
  - URL: https://foundryvtt.com/article/system-development/
  - Notes: System structure and manifest schema, useful if we graduate from macros.

- Content Packaging Guide
  - URL: https://foundryvtt.com/article/packaging-guide/
  - Notes: Packaging and distribution best practices.

## B — Community Curated Sources
- Foundry VTT Community Macros
  - URL: https://github.com/foundry-vtt-community/macros
  - Notes: Large set of examples; quality varies. Check version and dependencies. License is CC-BY-SA-4.0.

- Foundry VTT Community Tables
  - URL: https://github.com/foundry-vtt-community/tables
  - Notes: Good rolltable patterns and data structure examples. License is CC-BY-SA-4.0.

- Shadowdark Community Content (package listing)
  - URL: https://foundryvtt.com/packages/shadowdark-community-content
  - Notes: Curated community content for Shadowdark; system-specific.

- Shadowdark RPG System (source)
  - URL: https://github.com/Muttley/foundryvtt-shadowdark
  - Notes: Full system repo; good for system-level patterns and macro compendiums. MIT code, Shadowdark Third-Party License for content.

- ApplicationV2 Development Guide (third-party)
  - URL: https://docs.rayners.dev/seasons-and-stars/applicationv2-development/
  - Notes: Non-official, but practical examples for modern UI patterns.

- Illumination Buffer (module example)
  - URL: https://foundryvtt.com/packages/illuminationbuffer
  - Notes: Example of a v13/v14 API-focused module with rendering hooks.

- Iron Codex (module example)
  - URL: https://foundrymodules.com/releases/iron-codex.html
  - Notes: Module using official API; good for design patterns and structure.

## C — Mixed/Outdated Sources
- Foundry VTT Community Modules (deprecated list)
  - URL: https://github.com/foundry-vtt-community/modules
  - Notes: Historical list. Repo is replaced by a wiki and may be outdated.

- Foundry Community Macros (package listing)
  - URL: https://foundryvtt.com/packages/foundry_community_macros/
  - Notes: Package listing indicates older verified versions; treat as legacy (v11 era).

- Foundry-Macros (FXMaster/Midi-QOL-heavy)
  - URL: https://github.com/otigon/Foundry-Macros
  - Notes: Dependency-heavy and very specific to certain module stacks.

- Shemetz Macros (personal module)
  - URL: https://github.com/shemetz/shemetz-macros
  - Notes: Personal/unstable by author admission; good for ideas, verify carefully.

## How to Use This List
- Prefer A-tier sources for API or platform-level decisions.
- Use B-tier sources for example patterns, then validate with A-tier docs.
- Treat C-tier sources as historical references only.
