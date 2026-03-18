# Player Light Tracker — Design Philosophy

> For shared visual conventions (button tiers, dark aesthetic, blackletter titles), see [`ui-design-guide.md`](ui-design-guide.md).

## Personas

### Player

Wants to see what the status of their light is. If they have no active light source, the tracker shows the party's overall light status instead — the same torch animation and atmospheric blackletter text (e.g. *"The party has strong light — Don't stray"*), but **not** exact remaining duration. This tension is intentional and core to Shadowdark. "Is my torch about to go out?" is a question the game wants players to feel, not calculate.

### DM

Wants to debug light state. Has the Light Tracker for the entire party — the DM view prioritizes information density over atmosphere. They need to see the facts to manage the game.

## Window Title

The window title bar is hidden in both full and compact modes — it adds noise and competes with the content. The title only becomes visible when the window is collapsed, so the user can identify what the window is.

This pattern applies to all module dialogs (Light Tracker, Lost Citadel Random Encounter, etc.).

## Full Mode

The torch animation is the centerpiece and dominant visual. It communicates light state viscerally — players should **feel** the state of their light before they read any text.

- The torch animation occupies the center and commands attention
- Status text provides the light state in atmospheric blackletter — secondary reinforcement, not the primary signal
- Character portraits allow switching between tracked characters
- Everything else is removed to keep focus on the flame
- No douse button — dousing happens through inventory interaction or by asking the DM
- No light source name — the animation and status text say enough
- No window title — the content speaks for itself

## Compact Mode

Answers exactly one question: **"How's my light?"**

- Minimal footprint: one horizontal line
- Active character portrait (small) + status text
- Click/tap portrait to reveal character selector
- No title, no labels, no buttons — pure status glance
- The compact view is for players who want the tracker visible without it dominating screen space

## General Principles

**Atmosphere over chrome.** Information is communicated through the torch animation and atmospheric text, not through UI elements like buttons, labels, and status bars. Players should feel the state of their light, not read a dashboard.

**Intentional uncertainty.** Doubt about remaining duration is a core Shadowdark mechanic. The tracker deliberately avoids timers, percentages, or countdown indicators. The animation's behavior hints at urgency without quantifying it.

**The animation does the heavy lifting.** Text is secondary reinforcement. The animation tells the story. Status text adds flavor in blackletter, but a player glancing at the tracker should understand their situation from the animation alone.

**Less is more.** Every element that isn't the animation or the status text needs to justify its existence. If it doesn't serve the "How's my light?" question, it doesn't belong in the player view.
