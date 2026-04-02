# Task 061: Handle table section labels in hexmap PDF importer

Depends on task-060.

## Goal

Correctly recognise table section labels like "Arena Challenger" that appear above a die header. Use them to name the resulting RollTable. Do not attempt to associate the table with a specific hex entry — that requires semantic understanding the parser cannot provide.

## Background

In the Revenge of the Ravens hex key, page 23 has a table labelled "Arena Challenger" with a "d6 Opponent" die header below it. The label is a single-line body-bold block (Montserrat-Bold 10pt, H4 style in ShadowBrew) that sits in the left column above the die header.

Currently the label is consumed as a body paragraph of whichever hex entry is "current" in the parser. This is wrong.

### Why we cannot associate tables with hex entries

The Arena Challenger table sits below both columns on page 23. Gerta's Cave (507) is in the left column; The Sewer (511) is in the right column. There is no structural information in the PDF that ties the table to either entry. A human reader would infer from narrative context (The Sewer mentions a "pit fighting arena") that it belongs to The Sewer, but that's semantic understanding — not something a layout parser can determine.

The "PEOPLE YOU MEET" tables have the same ambiguity — "People You Meet in Bark" sits below both Hermod's Palace (316) and Bark (410). They work because the banner text explicitly names the location.

### What should happen to the label

Use it as the table name → the RollTable is called "Arena Challenger" (not "Gerta's Cave Table" or "The Sewer Table"). The label is the only reliable identifier. Remove it from the body text stream so it doesn't pollute any hex entry.

## Context

- `tools/journal-import/import_hexmap.py` — the importer script
- PDF page 23 (index 22): "Arena Challenger" at top=405.5, "d6 Opponent" at top=420.5
- The label is Montserrat-Bold 10pt (body-bold, H4 style) — NOT the 12pt header font
- It is a single-line, all-bold LEFT block
- It sits ~15pt above the die header on the same page, same column

### What distinguishes a table label from regular bold body text

A table label:
1. Is a single-line all-bold block
2. Is immediately followed (by vertical position, same page) by a die header block
3. Does not match `HEX_TITLE_RE` or `PEOPLE_HEADER_RE`

Regular bold body text (e.g. "Amphalion Golden Dawn") appears inline within paragraphs and is not followed by a die header.

## Plan

After task-060 implements table group extraction, extend it to look for a label block immediately above the die header:

1. When identifying a table group (die header + rows), also check for a single-line all-bold block within ~20pt above the die header on the same page
2. If found, use its text as the table name
3. Remove the label block from the general block list so it doesn't become a body paragraph
4. Tables without a label and without a "PEOPLE YOU MEET" banner get a generic name based on die header text (e.g. "d6 Opponent")

## Acceptance criteria

- [ ] "Arena Challenger" table is named "Arena Challenger"
- [ ] The label does not appear as a body paragraph in any hex entry
- [ ] Tables with "PEOPLE YOU MEET" banners still get their banner-derived names
- [ ] Tables without any label get a name from the die header (e.g. "d6 Opponent")
- [ ] No false positives — regular bold body text is not mistaken for a table label

## Scope boundaries

- **In scope**: Detecting and using table section labels for naming
- **Out of scope**: Associating tables with specific hex entries; rendering labels as HTML
- **Do not** change how "PEOPLE YOU MEET" banners are handled — they already work
