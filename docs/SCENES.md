# Scene Import Plan

## Goal

Have prepared scenes that can be imported into a world at will — one, several, or all at once.

## Approach: Scene Compendium Pack

Use a compendium pack of type `Scene` — the same pattern used for macros. Foundry's built-in compendium browser handles import (right-click → Import, or "Import All" from the pack header). No custom import UI or API code needed.

## What needs to happen

### 1. Scene source files

Create JSON definitions in `module/scenes/`:

```
module/scenes/
  scenes.json          # metadata index (like macros.json)
  tavern-basement.json # individual scene data
  forest-ambush.json
  ...
```

Each scene JSON follows the Foundry v14 schema (background image, grid config, walls, lights, tokens, etc.). Reference example: `third_party/foundryvtt/public/nue/defaultscene/scene.json`.

### 2. Background images

Scene backgrounds go in `module/assets/scenes/` and are referenced as `modules/foundry-homebrew/assets/scenes/<name>.webp`. These ship with the module.

### 3. Extend `build.mjs`

Add a compile step for scenes, same pattern as macros:

- Read scene definitions from `module/scenes/`
- Write intermediate JSON with `_key: "!scenes!<id>"`
- Compile to LevelDB at `module/packs/scenes/`

### 4. Update `module.json`

Add the pack:

```json
{
  "name": "scenes",
  "label": "Scenes",
  "path": "packs/scenes",
  "type": "Scene"
}
```

Add `"scenes"` to the `packFolders` array.

## Where scene data comes from

Two options:

- **Hand-authored**: Build the scene in a Foundry world, then export via `Scene.exportToJSON()` (or right-click export in sidebar). Save that JSON as the source file.
- **Generated**: Write a tool that produces scene JSON from some source (like the journal importer does for PDFs).

Most scenes are hand-authored in Foundry and exported. The compendium pack is the distribution mechanism.

## What is NOT needed

- No custom import macro or application code
- No new ES module
- No API calls — compendium import is built into Foundry
