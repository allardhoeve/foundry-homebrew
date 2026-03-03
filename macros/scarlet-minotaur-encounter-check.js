// Lost Citadel: Scarlet Minotaur Random Encounter Check
//
// Two-step encounter check for The Lost Citadel dungeon:
//   1. Roll 1d12 (normal) or 1d6 (noisy) — on a 1, roll the encounter table.
//   2. Encounter table is d8 with a cumulative -2 Minotaur penalty (see design doc).
//
// Persistent state: the current penalty is stored in game.settings (world scope)
// so it survives refreshes and is shared between GMs.
//
// Chat routing:
//   - No encounter       → GM whisper (safe flavor)
//   - Encounter result   → public chat (dramatic for Minotaur, standard otherwise)
//   - Debug breakdown    → GM whisper (raw roll, penalty, adjusted result, new penalty)

// --- Settings ------------------------------------------------------------------

const SETTING_NS  = "lost-citadel-macros";
const SETTING_KEY = "minotaurPenalty";

// Register once per world load. Guarded so re-running the macro doesn't throw.
if (!game.settings.settings.has(`${SETTING_NS}.${SETTING_KEY}`)) {
    game.settings.register(SETTING_NS, SETTING_KEY, {
        name:  "Scarlet Minotaur Penalty",
        hint:  "Cumulative -2 per table roll since last Minotaur encounter (The Lost Citadel).",
        scope:  "world",
        config: false,
        type:   Number,
        default: 0
    });
}

// --- Encounter Table -----------------------------------------------------------

// Array is 0-indexed; ENCOUNTERS[0] is the result for an adjusted roll of 1.
const ENCOUNTERS = [
    "The Scarlet Minotaur (Area 18) stalks into sight, bellowing challenges and pawing the stone.",
    "1d4 ettercaps and 1d8 beastmen clash in a bloody melee.",
    "A dry gust of wind extinguishes all torches and lamps.",
    "1d6 ettercaps creep along, searching for gold and gems.",
    "The skeletons of 1d6 dead adventurers or warrior-mages stagger into sight.",
    "2d4 beastmen argue in hushed whispers over who gets to eat the centipedes they just trapped in a bag.",
    "1d4 darkmantles swoop out, bobbing and spinning in a territorial warning dance.",
    "A cave creeper rushes along the ceiling toward light."
];

// --- Flavor Text ---------------------------------------------------------------

const encounterMessages = [
    "Something stirs in the darkness...",
    "The shadows grow hungry.",
    "Fate turns against you. Something approaches.",
    "The Citadel awakens. You are not alone.",
    "A chill runs down your spine. Too late to run.",
    "The darkness has noticed you.",
    "Dread footsteps echo in the black.",
    "The torch flickers. Something comes."
];

const safeMessages = [
    "The darkness holds its breath. You pass unseen.",
    "Fortune favors you... for now.",
    "The shadows remain still. Continue onward.",
    "No eyes watch from the black. Yet.",
    "The Citadel sleeps. Tread carefully.",
    "You move like ghosts through the gloom.",
    "The fates grant you a moment's reprieve.",
    "Silence. The predators hunt elsewhere.",
    "Your luck holds. The dark is quiet.",
    "Nothing stirs. But stay vigilant.",
    "The torchlight wards away what lurks beyond."
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Escape <, >, & before injecting strings into innerHTML.
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Minotaur ASCII Art --------------------------------------------------------

// Art by LS. Stored as an array to sidestep template-literal backtick/backslash
// escaping. escapeHtml() makes it safe for innerHTML; <pre> preserves whitespace.
const MINOTAUR_ASCII = escapeHtml([
    "       -\"\"\\",
    "    .-\"  .`)     (",
    "   j   .'_+     :[                )      .^--..",
    "  i    -\"       |l                ].    /      i",
    " ,\" .:j         `8o  _,,+.,.--,   d|   `:::;    b",
    " i  :'|          \"88p;.  (-.\"_\"-.oP        \\.   :",
    " ; .  (            >,%%%   f),):8\"          \\:'  i",
    "i  :: j          ,;%%%:; ; ; i:%%%.,        i.   `.",
    "i  `: ( ____  ,-::::::' ::j  [:```          [8:   )",
    "<  ..``'::::8888oooooo.  :(jj(,;,,,         [8::  <",
    "`. ``:.      oo.8888888888:;%%%8o.::.+888+o.:`:'  |",
    " `.   `        `o`88888888b`%%%%%88< Y888P\"\"'-    ;",
    "   \"`---`.       Y`888888888;;.,\"888b.\"\"\"..::::'-'",
    "          \"-....  b`8888888:::::.`8888._::-\"",
    "             `:::. `:::::O:::::::.`%%'|",
    "              `.      \"``::::::''    .'",
    "                `.                   <",
    "                  +:         `:   -';",
    "                   `:         : .::/",
    "                    ;+_  :::. :..;;;",
    "                    ;;;;,;;;;;;;;,;;"
].join("\n"));

// --- Application ---------------------------------------------------------------

class ScarletMinotaurEncounterApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "scarlet-minotaur-encounter",
        window: {
            title:       "The Lost Citadel: Random Encounter",
            resizable:   false,
            minimizable: true
        },
        position: { width: 380 }
    });

    // Renders fresh each time so the penalty display stays current after rolls.
    async _renderHTML(_context, _options) {
        const penalty        = game.settings.get(SETTING_NS, SETTING_KEY);
        const penaltyColor   = penalty > 0 ? "#ff6666" : "#aaa";
        const penaltyBg      = penalty > 0 ? "rgba(139,0,0,0.15)" : "rgba(255,255,255,0.07)";
        const penaltyBorder  = penalty > 0 ? "rgba(139,0,0,0.4)" : "rgba(255,255,255,0.15)";

        const container = document.createElement("div");
        container.innerHTML = `
            <div style="padding: 10px;">
                <div style="
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 10px;
                    padding: 6px 8px;
                    background: rgba(0,100,0,0.15);
                    border: 1px solid rgba(0,100,0,0.4);
                    border-radius: 4px;
                    line-height: 1.5;
                ">
                    Normal encounter roll is 1:6. You should roll this every other round, unless the party made noise.
                    In that case roll it that round. As convenience you can roll 1:12 every round, so you don't have to
                    track what round you rolled. An encounter occurs on a 1.
                </div>
                <div style="
                    font-size: 12px;
                    color: ${penaltyColor};
                    margin-bottom: 10px;
                    padding: 6px 8px;
                    background: ${penaltyBg};
                    border: 1px solid ${penaltyBorder};
                    border-radius: 4px;
                    display: flex;
                    align-items: baseline;
                    flex-wrap: wrap;
                    gap: 4px 6px;
                ">
                    <span>Scarlet Minotaur penalty:</span>
                    <select data-action="set-penalty" style="
                        font-size: 12px;
                        font-weight: bold;
                        color: ${penaltyColor};
                        background: ${penaltyBg};
                        border: 1px solid ${penaltyBorder};
                        border-radius: 3px;
                        padding: 2px 2px;
                        width: auto;
                        cursor: pointer;
                    ">
                        <option value="0" ${penalty === 0 ? 'selected' : ''}>0</option>
                        <option value="2" ${penalty === 2 ? 'selected' : ''}>−2</option>
                        <option value="4" ${penalty === 4 ? 'selected' : ''}>−4</option>
                        <option value="6" ${penalty === 6 ? 'selected' : ''}>−6</option>
                        <option value="8" ${penalty === 8 ? 'selected' : ''}>−8</option>
                    </select>
                    ${penalty > 0 ? '<div style="font-size: 11px; color: #999; width: 100%;">The penalty resets when you roll the Minotaur.</div>' : ''}
                </div>
                <div style="display: grid; gap: 8px;">
                    <button type="button" data-roll="1d12" data-label="Normal Check">
                        1d12 — Normal Check
                    </button>
                    <button type="button" data-roll="1d6" data-label="Made Noise">
                        1d6 — Characters Made Noise
                    </button>
                    <button type="button" data-roll="1d1" data-label="Encounter">
                        1 - Encounter now
                    </button>
                </div>
            </div>
        `;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (!root?.querySelectorAll) return;

        root.querySelectorAll("button[data-roll]").forEach(button => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                await this._runCheck(button.dataset.roll, button.dataset.label);
            });
        });

        root.querySelector("select[data-action='set-penalty']")?.addEventListener("change", async (event) => {
            await game.settings.set(SETTING_NS, SETTING_KEY, Number(event.target.value));
            this.render();
        });
    }

    // --- Check Roll ------------------------------------------------------------

    // Rolls the check die. On a 1, delegates to _rollEncounterTable.
    async _runCheck(die, label) {
        const roll   = await new Roll(die).evaluate();
        const result = roll.total;

        if (result === 1) {
            await this._rollEncounterTable(die, label, result);
        } else {
            // No encounter — whisper to GM only.
            ChatMessage.create({
                user:    game.user.id,
                content: `
                    <div style="text-align: center; padding: 10px;">
                        <div style="font-size: 14px; font-weight: bold; color: #666; margin-bottom: 5px;">
                            RANDOM ENCOUNTER CHECK
                        </div>
                        <div style="font-size: 12px; color: #777; margin-bottom: 6px;">
                            ${die} — ${label}
                        </div>
                        <div style="font-size: 48px; font-weight: bold; color: #4a5568;">
                            ${result}
                        </div>
                        <div style="font-size: 16px; font-weight: bold; color: #2d3748; margin-top: 10px;">
                            No Encounter
                        </div>
                        <div style="font-size: 13px; color: #4a5568; margin-top: 8px; font-style: italic;">
                            "${pick(safeMessages)}"
                        </div>
                    </div>
                `,
                whisper: [game.user.id],
                blind:   true,
                speaker: { alias: "The Darkness" }
            });
        }
    }

    // --- Encounter Table Roll --------------------------------------------------

    // Rolls 1d8, applies the Minotaur penalty, posts results, and updates state.
    async _rollEncounterTable(checkDie, checkLabel, checkResult) {
        const penalty        = game.settings.get(SETTING_NS, SETTING_KEY);
        const tableRoll      = await new Roll("1d8").evaluate();
        const rawResult      = tableRoll.total;
        // Clamp to 1: results below 1 are treated as 1 per the module rules.
        const adjustedResult = Math.max(1, rawResult - penalty);
        const encounter      = ENCOUNTERS[adjustedResult - 1];
        const isMinotaur     = adjustedResult === 1;

        // Penalty update: reset on Minotaur, otherwise increment for next roll.
        // First roll uses stored 0 (no penalty), subsequent rolls accumulate.
        const newPenalty = isMinotaur ? 0 : penalty + 2;
        await game.settings.set(SETTING_NS, SETTING_KEY, newPenalty);

        // Public encounter message.
        if (isMinotaur) {
            this._postMinotaurEncounter();
        } else {
            this._postEncounter(encounter);
        }

        // GM-only debug breakdown.
        this._postDebugInfo(checkDie, checkLabel, checkResult, rawResult, penalty, adjustedResult, newPenalty);

        // Refresh window to show updated penalty.
        this.render();
    }

    // --- Chat Messages ---------------------------------------------------------

    // Dramatic full-screen treatment for the Scarlet Minotaur — posted publicly.
    _postMinotaurEncounter() {
        ChatMessage.create({
            user:    game.user.id,
            content: `
                <div style="
                    text-align: center;
                    padding: 20px 16px;
                    background: linear-gradient(180deg, #0d0000 0%, #2a0000 60%, #1a0000 100%);
                    border: 2px solid #660000;
                    border-radius: 4px;
                ">
                    <div style="font-size: 10px; font-weight: bold; color: #993333; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 12px;">
                        The Lost Citadel
                    </div>
                    <div style="font-size: 32px; font-weight: bold; color: #cc0000; text-shadow: 0 0 16px #ff0000, 0 0 32px #660000; letter-spacing: 3px; line-height: 1.15; margin-bottom: 6px;">
                        THE SCARLET<br>MINOTAUR
                    </div>
                    <pre style="
                        font-family: 'Courier New', monospace;
                        font-size: 7px;
                        line-height: 1.2;
                        color: #cc4444;
                        margin: 10px auto;
                        padding: 0;
                        background: transparent;
                        border: none;
                        white-space: pre;
                        display: inline-block;
                        text-align: left;
                    ">${MINOTAUR_ASCII}</pre>
                    <div style="width: 60px; height: 2px; background: #660000; margin: 10px auto;"></div>
                    <div style="font-size: 13px; color: #ffaaaa; font-style: italic; line-height: 1.5; margin: 10px 0;">
                        Thundering hooves crack the stone. A blood-red hide fills the corridor.
                    </div>
                    <div style="font-size: 12px; color: #cc6666; margin-top: 10px; padding: 8px; background: rgba(100,0,0,0.35); border-radius: 3px; font-style: italic;">
                        "${pick(encounterMessages)}"
                    </div>
                </div>
            `,
            speaker: { alias: "The Lost Citadel" }
        });
    }

    // Standard encounter card — posted publicly.
    _postEncounter(encounter) {
        ChatMessage.create({
            user:    game.user.id,
            content: `
                <div style="text-align: center; padding: 10px;">
                    <div style="font-size: 14px; font-weight: bold; color: #666; margin-bottom: 5px;">
                        RANDOM ENCOUNTER
                    </div>
                    <div style="font-size: 16px; font-weight: bold; color: #8B0000; margin: 10px 0; font-style: italic;">
                        ⚔️ An encounter occurs!
                    </div>
                    <div style="
                        font-size: 14px;
                        color: #2d1a1a;
                        margin-top: 8px;
                        line-height: 1.5;
                        text-align: left;
                        padding: 8px 10px;
                        background: #fff5f5;
                        border-radius: 3px;
                        border-left: 3px solid #8B0000;
                    ">
                        ${encounter}
                    </div>
                    <div style="font-size: 13px; color: #aa0000; margin-top: 10px; font-style: italic;">
                        "${pick(encounterMessages)}"
                    </div>
                </div>
            `,
            speaker: { alias: "The Lost Citadel" }
        });
    }

    // GM-only whisper with full roll breakdown for verification.
    _postDebugInfo(checkDie, checkLabel, checkResult, rawD8, penalty, adjustedResult, newPenalty) {
        const penaltyChange = newPenalty === 0
            ? `${penalty} → 0 (reset — Minotaur encountered)`
            : `${penalty} → ${newPenalty} (+2)`;

        ChatMessage.create({
            user:    game.user.id,
            content: `
                <div style="font-size: 11px; color: #555; padding: 8px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 3px; line-height: 1.7;">
                    <strong>Encounter Debug</strong><br>
                    Check: ${checkDie} (${checkLabel}) = <strong>${checkResult}</strong><br>
                    Table: 1d8 = ${rawD8}, penalty = −${penalty}, adjusted = <strong>${adjustedResult}</strong><br>
                    Penalty: ${penaltyChange}
                </div>
            `,
            whisper: [game.user.id],
            blind:   true,
            speaker: { alias: "Debug" }
        });
    }
}

// --- Singleton -----------------------------------------------------------------

if (!game.scarletMinotaurEncounterApp) {
    game.scarletMinotaurEncounterApp = new ScarletMinotaurEncounterApp();
}

game.scarletMinotaurEncounterApp.render({ force: true });
