# UI Design Guide — Foundry Homebrew Tools

Principles distilled from the Light Tracker and Encounter Roller.

## Layout hierarchy: Title → Action → Status

The title dominates and anchors the window. The primary action comes next — buttons the GM
will click most often. Supporting info (status, penalties, hints) goes last as a quiet footer.
Never put status between the title and the action; it delays the main interaction.

## Title dominance

Blackletter titles should be visually larger than surrounding text. They anchor the window
identity and give each tool its character. When in doubt, make the title bigger.

## Button tiers

Three levels of visual weight signal frequency of use:

- **Primary** — warm amber, bold. The action the GM reaches for most.
- **Secondary** — muted but legible. Available but not competing for attention.
- **Debug / tertiary** — subtle. For testing or rare operations.

## Visual consistency across tools

These form a shared family:

- Dark background: `#1a1a1e`
- Warm parchment text: `#e8dcc8`
- Blackletter titles (JSL Blackletter)
- Amber primary buttons, muted secondary buttons

New tools should match this palette so they feel like parts of the same kit.

## Restraint with color signals

Use color (e.g. red for an active penalty) on **text**, not on borders or backgrounds of
small controls. One signal is enough — doubling up (red text + red border + red background)
creates noise. Let a single change carry the meaning.

## No inline CSS in JavaScript

Style via CSS classes. Inline styles cause bugs, are hard to maintain, and bypass the
cascade. Create a class in the stylesheet and reference it from the markup.

## Simplicity over decoration

If three text elements compete for attention, reduce to one or two. Hint text should be
shorter and quieter than labels. When a layout feels busy, remove rather than restyle.
