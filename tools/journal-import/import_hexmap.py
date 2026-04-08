"""
Import hex map entries from a ShadowBrew-formatted PDF into Foundry VTT
JournalEntry and RollTable JSON documents.

Uses pdfminer's layout analysis to identify text boxes, then classifies
them by x-range containment as LEFT column, RIGHT column, or FULL width.

Supports incremental chapter-based import: each invocation extracts a page
range into a named chapter.  Re-running the same chapter replaces its pages
while preserving other chapters in the journal.

Usage:
    uv run python import_hexmap.py <pdf_path> <first_page> <last_page> --chapter NAME --journal PATH [--name NAME]

Example:
    uv run python import_hexmap.py ~/devel/Ravens.pdf 20 25 --chapter "Hex Key" --journal ../output/ravens.json --name "Revenge of the Ravens"
    uv run python import_hexmap.py ~/devel/Ravens.pdf 28 37 --chapter "Mossmoor Ruins" --journal ../output/ravens.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import string
import sys
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path

from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTTextBox, LTTextLine, LTChar, LTAnno


# ---------------------------------------------------------------------------
# Constants – ShadowBrew template layout
# ---------------------------------------------------------------------------

PAGE_WIDTH = 420.0
COLUMN_MIDPOINT = PAGE_WIDTH / 2

# Page number threshold – ignore text near the bottom
PAGE_NUMBER_Y = 555

# Regex patterns
HEX_TITLE_RE = re.compile(r"^(\d+)\.\s+(.+)$")
ROOM_TITLE_RE = re.compile(r"^(V?\d{1,2})\.\s+(.+?)\.?\s*$")
PEOPLE_HEADER_RE = re.compile(r"PEOPLE YOU MEET IN (.+)")
DIE_HEADER_RE = re.compile(r"^(d\d+)\s*(.+)$")
TABLE_ROW_RE = re.compile(r"^(\d+(?:-\d+)?)\s+(.+)$")
XREF_RE = re.compile(r"\((\d{3,4})\)")


# ---------------------------------------------------------------------------
# Font helpers
# ---------------------------------------------------------------------------

def _base_font(fontname: str) -> str:
    return fontname.split("+")[-1] if "+" in fontname else fontname

def _is_bold(fontname: str) -> bool:
    base = _base_font(fontname)
    return "Bold" in base and "Italic" not in base

def _is_italic(fontname: str) -> bool:
    base = _base_font(fontname)
    return "Italic" in base and "Bold" not in base

def _is_bold_italic(fontname: str) -> bool:
    return "BoldItalic" in _base_font(fontname)

def _is_header_font(fontname: str, size: float) -> bool:
    """H5 black-bar headers: Montserrat-Bold at ~12pt."""
    return _is_bold(fontname) and size >= 11.5


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

class BlockType(Enum):
    LEFT = auto()
    RIGHT = auto()
    FULL = auto()

@dataclass
class RichSpan:
    text: str
    bold: bool = False
    italic: bool = False

@dataclass
class TextBlock:
    block_type: BlockType
    top: float
    lines: list[list[RichSpan]]
    page_num: int
    is_header: bool = False

    @property
    def text(self) -> str:
        return "\n".join(
            "".join(s.text for s in line).strip() for line in self.lines
        ).strip()

    @property
    def first_line(self) -> str:
        if self.lines:
            return "".join(s.text for s in self.lines[0]).strip()
        return ""

@dataclass
class TableRow:
    roll: str
    spans: list[RichSpan] = field(default_factory=list)

@dataclass
class RollTableData:
    name: str
    formula: str
    rows: list[TableRow] = field(default_factory=list)

@dataclass
class HexEntry:
    number: str
    name: str
    paragraphs: list[list[RichSpan]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

def _extract_rich_line(line: LTTextLine) -> list[RichSpan]:
    spans: list[RichSpan] = []
    current_text = ""
    current_bold = False
    current_italic = False

    for char in line:
        if isinstance(char, LTChar):
            bold = _is_bold(char.fontname) or _is_bold_italic(char.fontname)
            italic = _is_italic(char.fontname) or _is_bold_italic(char.fontname)
            if bold != current_bold or italic != current_italic:
                if current_text:
                    spans.append(RichSpan(current_text, current_bold, current_italic))
                current_text = char.get_text()
                current_bold = bold
                current_italic = italic
            else:
                current_text += char.get_text()
        elif isinstance(char, LTAnno):
            current_text += char.get_text()

    if current_text:
        spans.append(RichSpan(current_text, current_bold, current_italic))
    for s in spans:
        s.text = s.text.rstrip("\n")
    return [s for s in spans if s.text]


def _classify_block(box: LTTextBox) -> BlockType:
    """Classify by x-range containment: LEFT, RIGHT, or FULL."""
    if box.x1 <= COLUMN_MIDPOINT:
        return BlockType.LEFT
    if box.x0 >= COLUMN_MIDPOINT:
        return BlockType.RIGHT
    return BlockType.FULL


def _is_header_block(box: LTTextBox) -> bool:
    for line in box:
        if not isinstance(line, LTTextLine):
            continue
        for char in line:
            if isinstance(char, LTChar):
                if not _is_header_font(char.fontname, char.size):
                    return False
    return True


def _extract_blocks(pdf_path: Path, page_range: range) -> list[TextBlock]:
    laparams = LAParams(
        line_margin=0.5, word_margin=0.1, char_margin=2.0, boxes_flow=0.5,
    )
    all_blocks: list[TextBlock] = []

    for page_idx, page_layout in enumerate(extract_pages(str(pdf_path), laparams=laparams)):
        if page_idx not in page_range:
            continue

        page_height = page_layout.height

        for element in page_layout:
            if not isinstance(element, LTTextBox):
                continue

            top = page_height - element.y1
            if top > PAGE_NUMBER_Y:
                continue

            # Skip decorative fonts (e.g. "Hex Key" title)
            if any(
                isinstance(char, LTChar) and "NewRocker" in char.fontname
                for line in element if isinstance(line, LTTextLine)
                for char in line
            ):
                continue

            block_type = _classify_block(element)
            is_header = _is_header_block(element)

            lines = []
            for line in element:
                if isinstance(line, LTTextLine):
                    rich_line = _extract_rich_line(line)
                    if rich_line:
                        lines.append(rich_line)

            if lines:
                all_blocks.append(TextBlock(
                    block_type=block_type, top=top, lines=lines,
                    page_num=page_idx, is_header=is_header,
                ))

    return all_blocks


# ---------------------------------------------------------------------------
# Post-extraction: merge split roll-number blocks
# ---------------------------------------------------------------------------

def _merge_number_blocks(blocks: list[TextBlock]) -> list[TextBlock]:
    """Merge standalone roll-number blocks with adjacent text blocks."""
    by_pos: dict[tuple[int, float], list[TextBlock]] = {}
    for b in blocks:
        key = (b.page_num, round(b.top, 0))
        by_pos.setdefault(key, []).append(b)

    merged: list[TextBlock] = []
    consumed: set[int] = set()

    for i, block in enumerate(blocks):
        if i in consumed:
            continue
        text = block.text.strip()
        if re.match(r"^\d{1,2}$", text) and block.block_type == BlockType.LEFT:
            key = (block.page_num, round(block.top, 0))
            siblings = by_pos.get(key, [])
            target = next(
                (s for s in siblings
                 if s is not block and s.block_type in (BlockType.FULL, BlockType.LEFT)),
                None,
            )
            if target:
                number_span = RichSpan(text + " ")
                new_first = [number_span] + list(target.lines[0])
                target.lines = [new_first] + target.lines[1:]
                consumed.add(i)
                continue
        merged.append(block)

    return merged


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

def _order_blocks(blocks: list[TextBlock]) -> list[TextBlock]:
    """Order blocks per page: within each horizontal band, left then right.
    Full-width blocks define band boundaries.

    A ShadowBrew page is a vertical stack of regions. Each region is either
    two-column (left then right) or full-width. Full-width blocks split the
    page into bands.
    """
    pages = sorted(set(b.page_num for b in blocks))
    ordered: list[TextBlock] = []

    for page in pages:
        page_blocks = [b for b in blocks if b.page_num == page]

        left = sorted([b for b in page_blocks if b.block_type == BlockType.LEFT], key=lambda b: b.top)
        right = sorted([b for b in page_blocks if b.block_type == BlockType.RIGHT], key=lambda b: b.top)
        full = sorted([b for b in page_blocks if b.block_type == BlockType.FULL], key=lambda b: b.top)

        if not full:
            ordered.extend(left)
            ordered.extend(right)
            continue

        # Group consecutive full-width blocks into spans
        full_spans: list[tuple[float, float]] = []
        i = 0
        while i < len(full):
            span_top = full[i].top
            span_bottom = full[i].top
            j = i + 1
            while j < len(full) and full[j].top - span_bottom < 30:
                span_bottom = full[j].top
                j += 1
            full_spans.append((span_top, span_bottom))
            i = j

        def _in_range(blocks_list, y_min, y_max):
            return [b for b in blocks_list if y_min <= b.top < y_max]

        prev_bottom = 0.0
        for span_top, span_bottom in full_spans:
            # Two-column band above this full-width span
            ordered.extend(_in_range(left, prev_bottom, span_top))
            ordered.extend(_in_range(right, prev_bottom, span_top))
            # Full-width span
            ordered.extend([b for b in full if span_top <= b.top <= span_bottom])
            prev_bottom = span_bottom + 1

        # Remaining two-column content after last full-width span
        ordered.extend(_in_range(left, prev_bottom, 9999))
        ordered.extend(_in_range(right, prev_bottom, 9999))

    return ordered


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _title_case(s: str) -> str:
    words = s.split()
    minor = {"of", "the", "in", "a", "an", "and", "or", "for", "to", "at", "by"}
    return " ".join(
        w.capitalize() if i == 0 or w.lower() not in minor else w.lower()
        for i, w in enumerate(words)
    )

def _merge_spans(spans: list[RichSpan]) -> list[RichSpan]:
    if not spans:
        return []
    merged = [RichSpan(spans[0].text, spans[0].bold, spans[0].italic)]
    for s in spans[1:]:
        if s.bold == merged[-1].bold and s.italic == merged[-1].italic:
            merged[-1].text += s.text
        else:
            merged.append(RichSpan(s.text, s.bold, s.italic))
    if merged:
        merged[0].text = merged[0].text.lstrip()
        merged[-1].text = merged[-1].text.rstrip()
    return [s for s in merged if s.text]

def _block_lines_to_paragraph(block: TextBlock) -> list[RichSpan]:
    """Join lines into one paragraph. Handles soft hyphens and span merging."""
    spans: list[RichSpan] = []
    for i, line in enumerate(block.lines):
        if i > 0 and spans:
            prev = spans[-1]
            if prev.text.endswith("-"):
                next_start = line[0].text[0] if line and line[0].text else ""
                if next_start.islower():
                    prev.text = prev.text[:-1]  # remove soft hyphen
                else:
                    spans.append(RichSpan(" ", prev.bold, prev.italic))
            else:
                spans.append(RichSpan(" ", prev.bold, prev.italic))
        spans.extend(line)
    return _merge_spans(spans)

def _skip_leading_chars(spans: list[RichSpan], count: int) -> list[RichSpan]:
    result: list[RichSpan] = []
    remaining = count
    for s in spans:
        if remaining >= len(s.text):
            remaining -= len(s.text)
            continue
        if remaining > 0:
            result.append(RichSpan(s.text[remaining:], s.bold, s.italic))
            remaining = 0
        else:
            result.append(s)
    return _merge_spans(result)


# ---------------------------------------------------------------------------
# Table group extraction (position-based, runs before ordering)
# ---------------------------------------------------------------------------

def _find_table_name(blocks, die_block, consumed):
    """Determine the name for a table starting at die_block."""
    page = die_block.page_num
    die_top = die_block.top

    # 1. PEOPLE header above (e.g. "PEOPLE YOU MEET IN BARK")
    best_people = None
    for i, b in enumerate(blocks):
        if i in consumed or b.page_num != page:
            continue
        if b.is_header and b.top < die_top:
            m = PEOPLE_HEADER_RE.match(b.first_line)
            if m and die_top - b.top < 50:
                if best_people is None or b.top > best_people[1].top:
                    best_people = (i, b, m)
    if best_people:
        i, b, m = best_people
        consumed.add(i)
        return f"People You Meet in {_title_case(m.group(1))}"

    # 2. Bold label just above (e.g. "Arena Challenger")
    best_label = None
    for i, b in enumerate(blocks):
        if i in consumed or b.page_num != page:
            continue
        if b.top < die_top and die_top - b.top < 25 and not b.is_header:
            flat = [s for line in b.lines for s in line]
            if flat and all(s.bold for s in flat):
                if best_label is None or b.top > best_label[1].top:
                    best_label = (i, b)
    if best_label:
        i, b = best_label
        consumed.add(i)
        return b.first_line.strip()

    # 3. Generic header block above (e.g. "OVERLAND VILLAGE ENCOUNTERS")
    best_header = None
    for i, b in enumerate(blocks):
        if i in consumed or b.page_num != page:
            continue
        if b.is_header and b.top < die_top and die_top - b.top < 50:
            # Skip hex titles and people headers — handled above
            if HEX_TITLE_RE.match(b.first_line) or PEOPLE_HEADER_RE.match(b.first_line):
                continue
            if best_header is None or b.top > best_header[1].top:
                best_header = (i, b)
    if best_header:
        i, b = best_header
        consumed.add(i)
        return _title_case(b.first_line.strip())

    # 4. Nearest hex title above on same page
    best_hex = None
    for i, b in enumerate(blocks):
        if b.page_num != page or not b.is_header:
            continue
        m = HEX_TITLE_RE.match(b.first_line)
        if m and b.top < die_top:
            if best_hex is None or b.top > best_hex[1].top:
                best_hex = (i, b, m)
    if best_hex:
        _, b, m = best_hex
        return f"{_title_case(m.group(2))} Table"

    return "Table"


def _extract_table_groups(blocks):
    """Detect table structures by vertical position and extract them.

    Tables have a die header (e.g. "d6 Opponent") followed by numbered rows.
    The die header may be LEFT while rows are FULL, which causes the ordering
    logic to separate them. This groups them by position before ordering runs.

    Returns (remaining_blocks, tables).
    """
    tables = []
    consumed = set()

    for i, block in enumerate(blocks):
        if i in consumed:
            continue
        die_match = DIE_HEADER_RE.match(block.first_line)
        if not die_match or not die_match.group(2).strip()[0:1].isupper():
            continue

        formula = f"1{die_match.group(1)}"
        max_roll = int(re.search(r"d(\d+)", formula).group(1))
        consumed.add(i)

        table_name = _find_table_name(blocks, block, consumed)

        # Collect candidate blocks below die header on same page, by top
        candidates = []
        for j, b in enumerate(blocks):
            if j in consumed or b.page_num != block.page_num or b.top < block.top:
                continue
            candidates.append((j, b))
        candidates.sort(key=lambda x: x[1].top)

        # Parse rows from candidates
        rows = []
        for j, b in candidates:
            m = TABLE_ROW_RE.match(b.first_line)
            if m and int(m.group(1).split("-")[0]) <= max_roll:
                roll = m.group(1)
                all_spans = _block_lines_to_paragraph(b)
                combined = "".join(s.text for s in all_spans)
                skip_m = re.match(r"^(\d+(?:-\d+)?)\s*", combined)
                if skip_m:
                    all_spans = _skip_leading_chars(all_spans, len(skip_m.group(0)))
                rows.append(TableRow(roll=roll, spans=all_spans))
                consumed.add(j)
            elif rows:
                # Stop at structural boundaries
                if (b.is_header or HEX_TITLE_RE.match(b.first_line)
                        or PEOPLE_HEADER_RE.match(b.first_line)
                        or DIE_HEADER_RE.match(b.first_line)):
                    break
                # Continuation of previous row
                rows[-1].spans.append(RichSpan(" "))
                rows[-1].spans.extend(_block_lines_to_paragraph(b))
                rows[-1].spans = _merge_spans(rows[-1].spans)
                consumed.add(j)
            # No rows yet and block doesn't match — skip (other column content)

        tables.append(RollTableData(name=table_name, formula=formula, rows=rows))

    remaining = [b for i, b in enumerate(blocks) if i not in consumed]
    return remaining, tables


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _parse_table_rows(blocks, start_idx, max_roll=100):
    rows: list[TableRow] = []
    idx = start_idx
    while idx < len(blocks):
        block = blocks[idx]
        first = block.first_line
        m = TABLE_ROW_RE.match(first)
        if m and int(m.group(1).split("-")[0]) <= max_roll:
            roll = m.group(1)
            all_spans = _block_lines_to_paragraph(block)
            combined = "".join(s.text for s in all_spans)
            skip_m = re.match(r"^(\d+(?:-\d+)?)\s*", combined)
            if skip_m:
                all_spans = _skip_leading_chars(all_spans, len(skip_m.group(0)))
            rows.append(TableRow(roll=roll, spans=all_spans))
            idx += 1
        elif rows:
            if block.is_header or HEX_TITLE_RE.match(first) or PEOPLE_HEADER_RE.match(first):
                break
            if DIE_HEADER_RE.match(first):
                break
            prev = rows[-1]
            prev.spans.append(RichSpan(" "))
            prev.spans.extend(_block_lines_to_paragraph(block))
            prev.spans = _merge_spans(prev.spans)
            idx += 1
        else:
            break
    return rows, idx


def _detect_room_header(block: TextBlock):
    """Detect a dungeon room header in a body-text block.

    Room headers have a bold first span like ``V1. Kobold Burrow.`` or
    ``3. Training Grounds.`` at 10pt (not flagged as is_header).
    The identifier must contain at least one digit to avoid matching
    bold sub-items like ``Guards.`` or ``Treasure.``.

    Returns *(number, name, remaining_paragraph)* or *None*.
    """
    if block.is_header:
        return None
    if not block.lines or not block.lines[0]:
        return None
    first_span = block.lines[0][0]
    if not first_span.bold:
        return None
    m = ROOM_TITLE_RE.match(first_span.text.strip())
    if not m:
        return None
    number = m.group(1)
    name = m.group(2)

    # Build remaining paragraph from the rest of the block (skip the bold header)
    remaining_lines = []
    rest_of_first_line = list(block.lines[0][1:])
    # Strip stray leading period+space from the non-bold remainder
    # (happens when the PDF splits "Name" and ". Description" across spans)
    if rest_of_first_line:
        first_rest = rest_of_first_line[0]
        stripped = re.sub(r"^\.?\s*", "", first_rest.text)
        if stripped:
            rest_of_first_line[0] = RichSpan(stripped, first_rest.bold, first_rest.italic)
        else:
            rest_of_first_line = rest_of_first_line[1:]
    if rest_of_first_line:
        remaining_lines.append(rest_of_first_line)
    remaining_lines.extend(block.lines[1:])
    remaining_lines = [line for line in remaining_lines if line]

    if remaining_lines:
        temp = TextBlock(block_type=block.block_type, top=block.top,
                         lines=remaining_lines, page_num=block.page_num)
        para = _block_lines_to_paragraph(temp)
        return number, name, para
    return number, name, []


def parse_blocks(blocks):
    """Parse ordered blocks into intro paragraphs, location entries, and tables.

    Auto-detects both hex entries (12pt bold headers like ``504. LANDEL``)
    and room entries (10pt bold first-span like ``V1. Kobold Burrow.``).
    Text before the first location entry is collected as intro paragraphs
    for the chapter header page.
    """
    intro: list[list[RichSpan]] = []
    entries: list[HexEntry] = []
    tables: list[RollTableData] = []
    current_entry: HexEntry | None = None
    people_table_name: str | None = None
    idx = 0

    while idx < len(blocks):
        block = blocks[idx]
        first = block.first_line

        # --- 12pt header blocks ---
        if block.is_header:
            hex_match = HEX_TITLE_RE.match(first)
            people_match = PEOPLE_HEADER_RE.match(first)
            if hex_match:
                current_entry = HexEntry(
                    number=hex_match.group(1),
                    name=_title_case(hex_match.group(2)),
                )
                entries.append(current_entry)
                idx += 1
                continue
            if people_match:
                people_table_name = f"People You Meet in {_title_case(people_match.group(1))}"
                idx += 1
                continue
            # Section header (FACTIONS, VILLAGE LEVEL, etc.) — treat as
            # intro content or body paragraph with a heading tag
            para = [RichSpan(f"[h3]{first}[/h3]", bold=True)]
            if current_entry is None:
                intro.append(para)
            else:
                current_entry.paragraphs.append(para)
            idx += 1
            continue

        # --- Room entry header (bold first span, 10pt) ---
        room = _detect_room_header(block)
        if room:
            number, name, remaining = room
            current_entry = HexEntry(number=number, name=_title_case(name))
            entries.append(current_entry)
            if remaining:
                current_entry.paragraphs.append(remaining)
            idx += 1
            continue

        # --- Die header (table) ---
        die_match = DIE_HEADER_RE.match(first)
        if die_match and die_match.group(2).strip()[0:1].isupper():
            formula = f"1{die_match.group(1)}"
            table_name = people_table_name or (
                f"{current_entry.name} Table" if current_entry else "Table"
            )
            idx += 1
            max_roll = int(re.search(r"d(\d+)", formula).group(1))
            rows, idx = _parse_table_rows(blocks, idx, max_roll=max_roll)
            tables.append(RollTableData(name=table_name, formula=formula, rows=rows))
            people_table_name = None
            continue

        # --- Body text ---
        para = _block_lines_to_paragraph(block)
        if para:
            if current_entry is not None:
                current_entry.paragraphs.append(para)
            else:
                intro.append(para)
        idx += 1

    return intro, entries, tables


# ---------------------------------------------------------------------------
# HTML generation
# ---------------------------------------------------------------------------

def _spans_to_html(spans):
    """Convert rich spans to HTML.  Parenthesised 3-4 digit numbers become
    @hex[NNN] placeholders, resolved to @UUID links in a later pass.
    Section header markers [h3]...[/h3] are converted to <h3> tags."""
    parts = []
    for span in spans:
        text = span.text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        # Section header markers
        if text.startswith("[h3]") and text.endswith("[/h3]"):
            inner = text[4:-5]
            parts.append(f"</p><h3>{inner}</h3><p>")
            continue
        if span.bold and span.italic:
            text = f"<strong><em>{text}</em></strong>"
        elif span.bold:
            text = f"<strong>{text}</strong>"
        elif span.italic:
            text = f"<em>{text}</em>"
        parts.append(text)
    html = "".join(parts)
    return XREF_RE.sub(lambda m: f"(@hex[{m.group(1)}])", html)

def _dehyphenate(html):
    return re.sub(r"(\w)-\s+(\w)", lambda m: m.group(1) + m.group(2), html)


# ---------------------------------------------------------------------------
# Foundry VTT JSON
# ---------------------------------------------------------------------------

def _deterministic_id(seed: str, length: int = 16) -> str:
    """Stable ID derived from a seed string. Same seed always gives same ID."""
    return hashlib.sha256(seed.encode()).hexdigest()[:length]

def _random_id(length=16):
    import random
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))

def generate_chapter_pages(intro, entries, chapter_name, chapter_index):
    """Generate Foundry journal pages for one chapter.

    *intro* is a list of paragraph spans for the chapter header page.
    Returns a list of page dicts with @hex[NNN] placeholders still unresolved.
    Sort values place this chapter after previous ones.
    """
    base_sort = (chapter_index + 1) * 1_000_000
    pages = []

    # Chapter header / divider page (carries intro text if any)
    intro_html = "\n".join(
        f"<p>{_dehyphenate(_spans_to_html(para))}</p>" for para in intro
    ) if intro else ""
    # Clean up empty <p></p> around h3 tags
    intro_html = intro_html.replace("<p></p><h3>", "<h3>").replace("</h3><p></p>", "</h3>")
    intro_html = intro_html.replace("<p></p>", "")

    pages.append({
        "_id": _deterministic_id(f"{chapter_name}:__header__"),
        "name": chapter_name,
        "type": "text",
        "title": {"show": True, "level": 1},
        "text": {"content": intro_html, "format": 1},
        "sort": base_sort,
        "ownership": {"default": -1},
        "flags": {"shadowbrew": {"chapter": chapter_name, "chapterHeader": True}},
    })

    for i, entry in enumerate(entries):
        page_name = f"{entry.number}. {entry.name}" if entry.number else entry.name
        page_id = _deterministic_id(f"{chapter_name}:{page_name}")
        html_paragraphs = [
            f"<p>{_dehyphenate(_spans_to_html(para))}</p>"
            for para in entry.paragraphs
        ]
        content = "\n".join(html_paragraphs)
        # Clean up empty <p></p> around h3 tags
        content = content.replace("<p></p><h3>", "<h3>").replace("</h3><p></p>", "</h3>")
        content = content.replace("<p></p>", "")
        pages.append({
            "_id": page_id,
            "name": page_name,
            "type": "text",
            "title": {"show": True, "level": 2},
            "text": {"content": content, "format": 1},
            "sort": base_sort + (i + 1) * 1000,
            "ownership": {"default": -1},
            "flags": {"shadowbrew": {"chapter": chapter_name}},
        })

    return pages


def _resolve_xrefs(journal):
    """Resolve @hex[NNN] placeholders to @UUID links across all pages."""
    # Build map: hex number -> (page_id, display_name)
    hex_map = {}
    for page in journal["pages"]:
        m = re.match(r"^(\d{3,4})\.\s+(.+)$", page["name"])
        if m:
            hex_map[m.group(1)] = (page["_id"], page["name"])

    hex_placeholder_re = re.compile(r"@hex\[(\d{3,4})\]")

    def _replace(m):
        num = m.group(1)
        if num in hex_map:
            pid, name = hex_map[num]
            return f"@UUID[.{pid}]{{{name}}}"
        return f"({num})"  # revert unmatched to plain parenthesised number

    for page in journal["pages"]:
        content = page.get("text", {}).get("content", "")
        if "@hex[" in content:
            page["text"]["content"] = hex_placeholder_re.sub(_replace, content)

    return journal

def generate_roll_table(table, chapter_name=""):
    results = []
    for row in table.rows:
        text = _dehyphenate("".join(s.text for s in row.spans)).strip()
        if "-" in row.roll:
            low, high = row.roll.split("-")
            range_val = [int(low), int(high)]
        else:
            range_val = [int(row.roll), int(row.roll)]
        results.append({
            "_id": _random_id(), "type": 0, "text": text,
            "weight": 1, "range": range_val, "drawn": False,
        })
    return {
        "_id": _random_id(), "name": table.name, "formula": table.formula,
        "replacement": True, "displayRoll": True, "results": results,
        "folder": None, "sort": 0, "ownership": {"default": 0},
        "flags": {"shadowbrew": {"chapter": chapter_name}} if chapter_name else {},
    }


# ---------------------------------------------------------------------------
# Import macro generation
# ---------------------------------------------------------------------------

IMPORT_MACRO_TEMPLATE = """\
// Foundry VTT import macro for "{journal_name}"
// Paste into a Script Macro and run, or paste into the F12 console.
// Creates or updates the journal and roll tables (organised in folders).

const journalData = {journal_json};
const tableData = {tables_json};

// --- Helper: find or create a folder ---
async function getOrCreateFolder(name, type, parent = null) {{
  let folder = game.folders.find(f => f.name === name && f.type === type && f.folder?.id === (parent?.id ?? null));
  if (!folder) {{
    folder = await Folder.create({{ name, type, folder: parent?.id ?? null }});
  }}
  return folder;
}}

// --- Upsert journal ---
const journalFolder = await getOrCreateFolder("{journal_name}", "JournalEntry");
let journal = game.journal.get(journalData._id);
if (journal) {{
  const deleteIds = journal.pages.map(p => p._id);
  await journal.deleteEmbeddedDocuments("JournalEntryPage", deleteIds);
  await journal.update({{
    name: journalData.name,
    flags: journalData.flags,
    folder: journalFolder.id,
  }});
  await journal.createEmbeddedDocuments("JournalEntryPage", journalData.pages);
  ui.notifications.info(`Updated: ${{journal.name}} (${{journal.pages.size}} pages)`);
}} else {{
  journalData.folder = journalFolder.id;
  journal = await JournalEntry.create(journalData);
  ui.notifications.info(`Created: ${{journal.name}} (${{journal.pages.size}} pages)`);
}}

// --- Upsert roll tables (in chapter sub-folders) ---
const tablesRootFolder = await getOrCreateFolder("{journal_name}", "RollTable");
const chapterFolderCache = {{}};

for (const t of tableData) {{
  // Derive chapter from the "chapter: " prefix in the table name
  const chapter = t.flags?.shadowbrew?.chapter ?? "{journal_name}";
  if (!chapterFolderCache[chapter]) {{
    chapterFolderCache[chapter] = await getOrCreateFolder(chapter, "RollTable", tablesRootFolder);
  }}
  const folder = chapterFolderCache[chapter];

  let existing = game.tables.find(rt => rt.name === t.name);
  if (existing) {{
    const deleteIds = existing.results.map(r => r._id);
    await existing.deleteEmbeddedDocuments("TableResult", deleteIds);
    await existing.update({{ name: t.name, formula: t.formula, folder: folder.id }});
    await existing.createEmbeddedDocuments("TableResult", t.results);
    ui.notifications.info(`Updated table: ${{existing.name}}`);
  }} else {{
    t.folder = folder.id;
    const table = await RollTable.create(t);
    ui.notifications.info(`Created table: ${{table.name}}`);
  }}
}}
"""

def _generate_import_macro(journal: dict, roll_tables: list[dict], output_path: Path):
    """Generate a Foundry VTT import macro JS file."""
    journal_json = json.dumps(journal, ensure_ascii=False)
    tables_json = json.dumps(roll_tables, ensure_ascii=False)
    content = IMPORT_MACRO_TEMPLATE.format(
        journal_name=journal["name"],
        journal_json=journal_json,
        tables_json=tables_json,
    )
    with open(output_path, "w") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _load_or_create_journal(journal_path: Path, name: str) -> dict:
    """Load an existing journal JSON or create a new shell."""
    if journal_path.exists():
        with open(journal_path) as f:
            journal = json.load(f)
        print(f"Loaded existing journal: {journal['name']} ({len(journal['pages'])} pages)")
        return journal

    journal_id = _deterministic_id(f"journal:{name}")
    journal = {
        "_id": journal_id,
        "name": name,
        "pages": [],
        "ownership": {"default": 0},
        "folder": None,
        "sort": 0,
        "flags": {"shadowbrew": {"chapters": []}},
    }
    print(f"Creating new journal: {name}")
    return journal


def _merge_chapter(journal: dict, chapter_name: str, new_pages: list[dict]) -> dict:
    """Replace a chapter's pages in the journal, preserving other chapters."""
    flags = journal.setdefault("flags", {}).setdefault("shadowbrew", {})
    chapters = flags.setdefault("chapters", [])

    # Determine chapter index
    if chapter_name in chapters:
        chapter_index = chapters.index(chapter_name)
        # Remove old pages for this chapter
        old_count = len(journal["pages"])
        journal["pages"] = [
            p for p in journal["pages"]
            if p.get("flags", {}).get("shadowbrew", {}).get("chapter") != chapter_name
        ]
        removed = old_count - len(journal["pages"])
        print(f"Replacing chapter '{chapter_name}' ({removed} old pages removed)")
    else:
        chapter_index = len(chapters)
        chapters.append(chapter_name)
        print(f"Adding new chapter '{chapter_name}' (index {chapter_index})")

    # Recalculate sort values for the new pages based on chapter index
    base_sort = (chapter_index + 1) * 1_000_000
    for i, page in enumerate(new_pages):
        page["sort"] = base_sort + i * 1000

    journal["pages"].extend(new_pages)
    journal["pages"].sort(key=lambda p: p["sort"])
    return journal


def main():
    parser = argparse.ArgumentParser(
        description="Import hex map from a ShadowBrew PDF into Foundry VTT JSON"
    )
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("first_page", type=int)
    parser.add_argument("last_page", type=int)
    parser.add_argument("--chapter", required=True,
                        help="Chapter name for this batch of pages")
    parser.add_argument("--journal", required=True, type=Path,
                        help="Path to journal JSON (created if missing, appended if exists)")
    parser.add_argument("--name", default="Journal",
                        help="Journal display name (used only on first creation)")
    args = parser.parse_args()

    if not args.pdf_path.exists():
        print(f"Error: PDF not found: {args.pdf_path}", file=sys.stderr)
        sys.exit(1)
    args.journal.parent.mkdir(parents=True, exist_ok=True)

    page_range = range(args.first_page - 1, args.last_page)

    # --- Extract ---
    print(f"Extracting pages {args.first_page}-{args.last_page}...")
    blocks = _extract_blocks(args.pdf_path, page_range)
    print(f"  {len(blocks)} text blocks")

    blocks = _merge_number_blocks(blocks)
    print(f"  {len(blocks)} after merging number blocks")

    blocks, tables = _extract_table_groups(blocks)
    print(f"  {len(tables)} tables extracted, {len(blocks)} blocks remaining")

    ordered = _order_blocks(blocks)

    for b in ordered:
        label = f"{'HDR' if b.is_header else '   '} {b.block_type.name:5s}"
        print(f"  {label} p={b.page_num} top={b.top:6.1f} | {b.first_line[:60]}")

    intro, entries, inline_tables = parse_blocks(ordered)
    tables.extend(inline_tables)

    # Prefix table names with chapter to avoid cross-chapter collisions,
    # then deduplicate within the chapter by numbering
    for t in tables:
        t.name = f"{args.chapter}: {t.name}"
    name_counts: dict[str, int] = {}
    for t in tables:
        name_counts[t.name] = name_counts.get(t.name, 0) + 1
    seen: dict[str, int] = {}
    for t in tables:
        if name_counts[t.name] > 1:
            seen[t.name] = seen.get(t.name, 0) + 1
            t.name = f"{t.name} {seen[t.name]}"

    print(f"\n{len(intro)} intro paragraphs, {len(entries)} entries, {len(tables)} tables")
    for e in entries:
        print(f"  {e.number}. {e.name} ({len(e.paragraphs)} para)")
    for t in tables:
        print(f"  Table: {t.name} ({t.formula}, {len(t.rows)} rows)")

    # --- Load / create journal ---
    journal = _load_or_create_journal(args.journal, args.name)

    # Determine chapter index (peek at existing chapters)
    chapters = journal.get("flags", {}).get("shadowbrew", {}).get("chapters", [])
    chapter_index = chapters.index(args.chapter) if args.chapter in chapters else len(chapters)

    # --- Generate chapter pages ---
    new_pages = generate_chapter_pages(intro, entries, args.chapter, chapter_index)
    print(f"\nGenerated {len(new_pages)} pages for chapter '{args.chapter}'")

    # --- Merge into journal ---
    journal = _merge_chapter(journal, args.chapter, new_pages)

    # --- Resolve cross-references across all chapters ---
    journal = _resolve_xrefs(journal)

    # --- Write journal ---
    with open(args.journal, "w") as f:
        json.dump(journal, f, indent=2)
    total = len(journal["pages"])
    chapters = journal["flags"]["shadowbrew"]["chapters"]
    print(f"\nJournal: {args.journal} ({total} pages, chapters: {chapters})")

    # --- Write roll tables ---
    output_dir = args.journal.parent
    for table in tables:
        rt = generate_roll_table(table, chapter_name=args.chapter)
        slug = re.sub(r"[^a-z0-9]+", "-", table.name.lower()).strip("-")
        table_path = output_dir / f"rolltable-{slug}.json"
        with open(table_path, "w") as f:
            json.dump(rt, f, indent=2)
        print(f"RollTable: {table_path}")

    # --- Generate import macro (includes ALL roll tables in output dir) ---
    all_roll_tables = []
    for rt_path in sorted(output_dir.glob("rolltable-*.json")):
        with open(rt_path) as f:
            all_roll_tables.append(json.load(f))
    macro_path = output_dir / "import-macro.js"
    _generate_import_macro(journal, all_roll_tables, macro_path)
    print(f"Macro: {macro_path} ({len(all_roll_tables)} tables)")


if __name__ == "__main__":
    main()
