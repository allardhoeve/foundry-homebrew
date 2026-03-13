# Player Light Tracker — Design Philosophy

## Personas

### Player

Wants to know the status of their light at a glance. If they have no light source active, they should get a sense of the party's light situation. Crucially, they should **not** get exact remaining duration — the uncertainty is part of Shadowdark's tension. "Is my torch about to go out?" is a question the game wants players to feel, not calculate.

### DM

Wants to debug and manage light state across the entire party. Has access to the full Light Tracker with all characters visible. The DM view prioritizes information density over atmosphere — they need to know the facts.

## Full Mode

The torch animation is the centerpiece and dominant visual. It communicates light state viscerally — a healthy flame, a guttering flicker, darkness. Players should **feel** the state of their light before they read any text.

- The torch animation occupies the center and commands attention
- Status text provides the light state in atmospheric blackletter — secondary reinforcement, not the primary signal
- Character portraits allow switching between tracked characters
- Everything else is removed to keep focus on the flame
- No douse button — players know what they lit and when it's time
- No light source name — the animation and status text say enough

## Compact Mode

Answers exactly one question: **"How's my light?"**

- Minimal footprint: one horizontal line
- Active character portrait (small) + status text
- Hover/click portrait to reveal character selector
- No title, no labels, no buttons — pure status glance
- The compact view is for players who want the tracker visible without it dominating screen space

## General Principles

**Atmosphere over chrome.** Information is communicated through the torch animation and atmospheric text, not through UI elements like buttons, labels, and status bars. Players should feel the state of their light, not read a dashboard.

**Intentional uncertainty.** Doubt about remaining duration is a core Shadowdark mechanic. The tracker deliberately avoids timers, percentages, or countdown indicators. The animation's behavior hints at urgency without quantifying it.

**The animation does the heavy lifting.** Text is secondary reinforcement. The flame tells the story — healthy, flickering, dying, gone. Status text adds flavor in blackletter, but a player glancing at the tracker should understand their situation from the animation alone.

**Less is more.** Every element that isn't the animation or the status text needs to justify its existence. If it doesn't serve the "How's my light?" question, it doesn't belong in the player view.
