# Allard's Foundry Homebrew

A personal FoundryVTT module for Shadowdark and The Lost Citadel, written for Foundry v14 (build 360) using the V2 Application framework.

## Features

### Player Light Tracker

A module-loaded application that tracks light sources for the party. Registered as an ES module via `module.json`.

### Macros

#### `random-encounter-check.js`

A generic random encounter check for **Shadowdark**. Opens a persistent floating window with quick-roll buttons. Results are whispered to the GM only.

The check die is adjusted so you can roll every round regardless of the dungeon's danger level:

| Button | Die | Cadence |
|--------|-----|---------|
| Deadly | 1d6 | ~1-in-6 every round |
| Dangerous | 1d12 | ~1-in-12 every round |
| Unsafe | 1d18 | ~1-in-18 every round |

An encounter occurs on a roll of 1.

#### `scarlet-minotaur-encounter-check.js`

A two-step encounter check for **The Lost Citadel** dungeon module, implementing the Scarlet Minotaur's cumulative penalty rule.

**Step 1 — Check roll:**

| Button | Die | When to use |
|--------|-----|-------------|
| Normal Check | 1d12 | Every other round (or every round as a convenience) |
| Characters Made Noise | 1d6 | The round the party made noise |
| Encounter now | 1d1 | Force an immediate encounter |

On a roll of 1, the macro automatically proceeds to the encounter table.

**Step 2 — Encounter table (1d8):**

Each roll after the first applies a cumulative −2 penalty to the result (clamped to 1). The penalty resets when the Scarlet Minotaur is encountered. The current penalty is stored in `game.settings` (world scope) so it persists across sessions and is shared between GMs.

See `docs/scarlet-minotaur-random-encounter-check.md` for full design notes and the encounter table.

**Chat routing:**

| Event | Audience | Style |
|-------|----------|-------|
| No encounter | GM whisper | Muted flavor text |
| Encounter (non-Minotaur) | Public | Red encounter card |
| Scarlet Minotaur | Public | Dramatic dark styling with ASCII art |
| Debug breakdown | GM whisper | Raw roll, penalty, adjusted result |

## Installation

### As a module (recommended)

Install directly from the Foundry **Add-on Modules** tab using the manifest URL:

```
https://raw.githubusercontent.com/allardhoeve/foundry-homebrew/main/module/module.json
```

The macros will appear in a **Macros** compendium pack under the module. Import them into your world and run from there.

### Manual (paste into macro slot)

1. In Foundry, open the Macro Directory.
2. Create a new macro with type **Script**.
3. Paste the contents of the `.js` file.
4. Save and execute.

Each macro registers a singleton application on the `game` object so re-running it reopens the existing window rather than creating a duplicate.

## Module structure

A FoundryVTT module's installed directory mirrors the layout below. The `module.json` manifest at the root declares which scripts, styles, and packs Foundry should load.

```
module-name/
├── module.json       # Module manifest (required) — declares metadata,
│                     #   esmodules, styles, packs, and compatibility
├── src/              # ES module scripts loaded by Foundry
│   └── *.js          #   (referenced in module.json "esmodules")
├── styles/           # CSS stylesheets
│   └── *.css         #   (referenced in module.json "styles")
├── assets/           # Static assets served by Foundry
│   ├── audio/
│   ├── images/
│   └── video/
├── macros/           # Macro source files (compiled into packs/)
├── packs/            # Compendium packs (LevelDB, built from macros/)
│   └── macros/
└── templates/        # Handlebars templates (optional)
    └── *.hbs
```

## Repository structure

This repository adds development and reference files around the module structure:

```
.
├── module/                    # Foundry module files (what gets deployed)
│   ├── module.json            #   FoundryVTT module manifest
│   ├── src/                   #   Module ES modules
│   ├── styles/                #   Module CSS
│   ├── assets/                #   Images, audio, video
│   ├── macros/                #   Macro source files + macros.json metadata
│   └── packs/                 #   Compendium packs (build artifact)
├── build.mjs                  # Build script: macros/*.js → packs/macros/ (LevelDB)
├── package.json               # Node dependencies (foundryvtt-cli)
├── docs/                      # API notes, design docs, module dev notes
├── todo/                      # Task tracking
├── examples/                  # Reference macros and tables
└── third_party/               # Git submodules (community macros/tables, Shadowdark system)
```

## Releasing

Push a version tag to trigger the GitHub Actions release workflow:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow builds the compendium pack, stamps the version into `module.json`, zips everything, and attaches `module.zip` to the GitHub release. The manifest URL in `module.json` always points to the latest release zip.

## Requirements

- FoundryVTT v14 (build 360+)
- The `ApplicationV2` API (`foundry.applications.api.ApplicationV2`)
- The Shadowdark system (`foundryvtt-shadowdark`) for Shadowdark-specific macros

## License

See `LICENSE`. Third-party submodules in `third_party/` carry their own licenses — see `third_party/README.md` for details.
