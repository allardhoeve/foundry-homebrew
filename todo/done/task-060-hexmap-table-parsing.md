# Task 060: Analyse and fix table parsing in hexmap PDF importer

Independent.

## Goal

Analyse every table in the Revenge of the Ravens hex key (pages 20-25), understand why some parse correctly and others don't, then implement a robust table parsing strategy that works for all ShadowBrew table layouts.

## Background

The hexmap importer (`tools/journal-import/import_hexmap.py`) extracts hex entries and roll tables from ShadowBrew-formatted PDFs. It uses pdfminer's `LTTextBox` grouping and classifies blocks by x-range containment (LEFT, RIGHT, FULL).

The core problem: tables in ShadowBrew PDFs have a **die header** (e.g. "d6 Opponent") that sits in a column, but the **table rows** span full width. The current band-based ordering separates them — the die header ends up in the left column stream while the rows end up in the full-width stream after the right column.

## Context

- `tools/journal-import/import_hexmap.py` — the importer script (clean baseline, no hacks)
- PDF: `~/Documents/Shadowdark/Revenge_of_the_Ravens_-_v_1_1_-_Grimoire_Games_compressed.pdf`, pages 20-25
- Template: `~/Documents/Shadowdark/Shadowbrew.pdf` — the ShadowBrew template docs

### What we know from exploration

- pdfminer's `LTTextBox` correctly groups characters into logical text blocks
- Block classification by x-range containment (LEFT/RIGHT/FULL) is geometrically sound
- Band-based ordering (left col → full-width → right col within each band) works for body text
- The column gap is ~14pt (x=202 to x=217)
- Die headers are physically narrow (fit in one column) but logically introduce a full-width table
- Table rows span full width and are correctly classified as FULL
- Roll numbers are sometimes split into separate tiny LEFT blocks (already handled by `_merge_number_blocks`)

## Analysis: tables in the hex key

### Table 1: People You Meet in Bark (page 21, d8, 8 rows)
- **Banner**: "PEOPLE YOU MEET IN BARK" — FULL (centred, x=122-298)
- **Die header**: "d8 Encounter" — LEFT (x=41-117)
- **Rows**: FULL blocks (x=46-372)
- **Status**: Parses correctly (8 rows). Die header is LEFT but appears just before the FULL rows in the band ordering because there's no right-column content between them.

### Table 2: People You Meet in Landel (page 22, d10, 10 rows)
- **Banner**: "PEOPLE YOU MEET IN LANDEL" — FULL (x=114-307)
- **Die header**: "d10 Encounter" — LEFT (x=41-133)
- **Rows**: FULL blocks
- **Status**: Parses correctly (10 rows). Entire page is essentially full-width (504. LANDEL spans both columns), so the die header and rows are adjacent in ordering.

### Table 3: Arena Challenger (page 23, d6, 6 rows) — inside Gerta's Cave (507)
- **Label**: "Arena Challenger" — LEFT (x=37-128), body-bold
- **Die header**: "d6 Opponent" — LEFT (x=43-119)
- **Rows 1-3**: LEFT? or FULL? (rows start narrow then widen)
- **Rows 4-6**: FULL blocks (x=44-372)
- **Status**: **BROKEN — 0 rows**. Die header is LEFT, consumed within Gerta's Cave column. Rows are FULL, placed after The Sewer's right-column content in the ordering. The die header and rows are completely separated.

### Table 4: People You Meet in Riverton (page 24, d6, 6 rows)
- **Banner**: "PEOPLE YOU MEET IN RIVERTON" — FULL (centred)
- **Die header**: "d6 Encounter" — LEFT (x=41-117)
- **Rows**: FULL blocks
- **Status**: Parses correctly (6 rows). Same pattern as Bark — works because the band ordering happens to keep them adjacent.

### Why some work and others don't

Tables 1, 2, 4 work because their full-width rows appear in a band where no right-column content intervenes. Table 3 fails because there IS right-column content (The Sewer) at the same vertical position. The band ordering puts left col → right col → full-width, separating the die header from its rows.

## Plan

### Step 1: Identify table groups during extraction

Before ordering, scan for table structures: a die header block followed (by vertical position, regardless of column) by numbered row blocks. Group these into a "table unit" that stays together.

Detection criteria for a table group:
1. A block matching `DIE_HEADER_RE` (e.g. "d6 Opponent")
2. Followed by blocks whose first line starts with a number ≤ the die max
3. The rows may be LEFT, RIGHT, or FULL — doesn't matter
4. Optionally preceded by a bold label block (e.g. "Arena Challenger")

### Step 2: Extract table groups before ordering

Remove table-group blocks from the general block list. Process them separately into `RollTableData` objects. This way the ordering logic never needs to worry about keeping die headers near their rows — they're already parsed.

### Step 3: Handle the "0 rows" fallback

After the initial table parse, if a table has 0 rows, try a second strategy:
- Look at ALL blocks on the same page with `top` >= die header `top`
- Filter for blocks whose text starts with a valid roll number
- These are the rows, regardless of their column classification

### Step 4: Associate tables with hex entries

The die header's original column tells us which hex entry owns the table. A LEFT die header on a page where 507 (Gerta's Cave) is the left-column entry → the table belongs to Gerta's Cave.

## Constraints

- No position-based heuristics that assume specific x-coordinates or gap sizes
- The x-range containment classification (LEFT/RIGHT/FULL) is the foundation — don't change it
- The solution must work for any ShadowBrew two-column PDF, not just this specific adventure

## Acceptance criteria

- [ ] All 4 tables parse with correct row counts: Bark (8), Landel (10), Arena Challenger (6), Riverton (6)
- [ ] Table rows contain the correct text (spot-check each table)
- [ ] All 17 hex entries still parse with reasonable paragraph counts
- [ ] The Sewer does not absorb Arena Challenger table rows (should have ~5 paragraphs, not 11)
- [ ] No promotion/reclassification hacks in the ordering logic
- [ ] Script runs cleanly on the compressed PDF

## Scope boundaries

- **In scope**: Table detection, parsing, and association with hex entries
- **Out of scope**: Other PDF sections beyond the hex key; HTML generation changes; Foundry JSON format changes
- **Do not** modify the block extraction or x-range classification logic
