# Task 076: Blessing Boons roll table

Independent of other tasks.

## Goal

Add a 1d10 Blessing Boons roll table to the Roll Tables compendium (`module/tables/`), the same way as Random Social Encounters and Travel Scenery.

## Background

Blessings are for when the gods are pleased with what the party did. Sometimes the favour is divine, sometimes it is a local community showing its approval.

The boons come from Level Up: Advanced 5th Edition (a5e.tools, "Blessing Boons (1d12)"), adapted for Shadowdark. Two of the original twelve were dropped (the pollen stains and the witnesses telling everyone), which makes it a 1d10. Credit it like the other A5E tables (EN Publishing, CC BY 4.0), but say "adapted for Shadowdark" instead of "lightly edited". The repo is public, so check that the boons are in the A5E SRD before releasing.

## Design decisions (resolved)

| A5E term | Shadowdark conversion |
|----------|-----------------------|
| Expertise die | A flat +1d4 bonus, no expertise language |
| Inspiration | Advantage |
| Short rest | Not used. Boons that hung off one give something at camp or on the hex map instead |
| Healing over time | Not useful, Shadowdark heals fully every night. #6 gives +1d4 on Constitution checks instead |

## Table

| d10 | Boon | Change from A5E |
|-----|------|-----------------|
| 1 | The adventurers discover an enchanted spring. When a creature consumes water directly from the spring, for the next hour it gains advantage on Strength checks, and the party can travel one extra hex today. Water that is bottled or otherwise stored for later retains this blessing for only 1 hour. | Carrying capacity replaced by +1 hex travel |
| 2 | Spirit who wants to give the adventurers a gift. The item appears to be extremely mundane, but has an immense situational benefit (such as an arrow of dragon slaying or waterskin with a secret compartment holding a potion of superior healing). | Unchanged |
| 3 | Something the party did not intend frees a trapped spirit or undoes an ancient curse, granting each of them good fortune for 1 week. While an adventurer has good fortune, the next time they roll a natural 1 on a d20 they reroll the die, expending their good fortune. | Unchanged |
| 4 | The party witnesses an aurora in the night sky. Their camp is secure that night: no random encounter finds them, and the wolves pass the camp without noticing them. | Long rest replaced by a secure camp |
| 5 | Butterflies follow the party. If an adventurer holds out a finger, a butterfly lands on it and they gain +1d4 on their next saving throw. Once 1d4+1 butterflies have granted this boon the rest disappear. | Expertise die is +1d4 |
| 6 | The next time the party uses healing magic the location around them becomes a holy site infused with radiant power. The faithful begin traveling far and wide to rest at this site. Any living creature that spends 24 hours in the area gains +1d4 on its next Constitution check to stabilize, heal, or resist disease. | 2d4 hit points replaced by +1d4 on Constitution checks |
| 7 | One adventurer finds an important trophy or trinket that grants them advantage on one roll (though they lose the keepsake after the advantage is used). | Inspiration is advantage |
| 8 | An air elemental impressed by the party lightens their burdens. The party can travel one extra hex, or each adventurer increases their Speed by 5 feet, whichever comes first. Then the blessing ends. | Lasts until first use instead of until a rest, +1 hex option |
| 9 | The adventurers find a book filled with stories about their quests and successes. Once per week, a new paragraph appears on its pages and after reading it one PC gains +1d4 on an ability check (whichever member of the party chooses to use it first). | Expertise die is +1d4 |
| 10 | One of the adventurers gets bitten by an insect that leaves a wound in a geometric shape which won't go away. The next time they fail a Wisdom saving throw against a spell, they succeed instead and the bite mark disappears. | Unchanged |

Dropped from the A5E original: #11 (pollen stains, Charisma with locals) and #12 (witnesses spread the story, Charisma in the region).

## Acceptance criteria

- [x] Boons chosen and adapted (1d10)
- [x] `module/tables/blessing-boons.json` added, 1d10, builds into the Roll Tables pack
- [ ] Source confirmed in the A5E SRD
- [x] Released in 1.10.0
