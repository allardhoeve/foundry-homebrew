# Task 062: Create a proper Foundry VTT importer for parsed hex map data

Depends on task-060.

## Goal

Build a proper import mechanism to get the parsed hex map data (journal entries, roll tables) into a Foundry VTT world, with working internal links.

## Background

The hex map parser (`tools/journal-import/import_hexmap.py`) generates Foundry-compatible JSON for JournalEntry and RollTable documents. Currently we use a throwaway script macro to import, but this has a known issue: `@UUID` cross-references between journal pages use pre-generated IDs that get discarded on import, so all internal links are broken.

### Import options explored

1. **Script macro** — `JournalEntry.create()` / `RollTable.create()`. Quick for testing but links break because Foundry reassigns IDs. Would need a two-pass approach: create first, then update page content with real IDs.

2. **Adventure document** — A Foundry Adventure bundles journals, tables, actors, scenes etc. into one importable package. This is how the Lost Citadel quickstart works. Lives in a compendium pack inside a module. The "Import Adventure" UI handles everything.

3. **Module compendium pack** — Place the journal/tables in the module's pack folder. Users import from the compendium into their world.

### What the Lost Citadel does

The Lost Citadel is an Adventure document in a compendium pack (`quickstart-adventures.db`). It contains:
- Journal entries with working `@UUID` links (IDs are stable within the adventure)
- Actors (monsters)
- A Scene with 28 Note pins linking to journal pages at x,y positions on the map

### Map notes

Foundry Scenes can have Note pins at x,y coordinates that open a specific journal page when clicked. For the hex map this would mean:
- A Scene with the hex map image
- One Note per hex location, pinned at the hex's position
- Each Note links to the corresponding journal page via `entryId` + `pageId`

This requires either manual pin placement in Foundry or knowing the pixel coordinates of each hex on the map image.

## Plan

### Phase 1: Working import with links

Generate an import macro that:
1. Creates the JournalEntry and RollTables
2. Reads back the Foundry-assigned page IDs
3. Updates `@UUID` references in page content to use real IDs
4. Skips import if documents already exist (idempotent)

### Phase 2: Adventure document (future)

Package as an Adventure in the module's compendium. This is the proper long-term approach but requires more infrastructure (the module build pipeline).

### Phase 3: Scene with map notes (future)

If a hex map image is available, generate a Scene with Note pins for each hex location.

## Acceptance criteria

- [ ] Journal imports with all `@UUID` cross-references working (clickable links between hex pages)
- [ ] Roll tables import correctly
- [ ] Running the import twice does not create duplicates
- [ ] Import can be re-run to update content (delete and recreate, or update in place)

## Scope boundaries

- **In scope**: Phase 1 (macro with working links)
- **Out of scope**: Adventure document packaging, Scene/map notes, monster actor creation
