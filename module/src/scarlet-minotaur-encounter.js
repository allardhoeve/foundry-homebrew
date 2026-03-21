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

const SME_MODULE_ID = "foundry-homebrew";
const SME_SETTING_NS  = "lost-citadel-macros";
const SME_SETTING_KEY = "minotaurPenalty";
const SME_ROLLMODE_KEY = "rollMode";

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
    }, { inplace: false });

    toggleInterface() {
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
        }
    }

    // Renders fresh each time so the penalty display stays current after rolls.
    async _renderHTML(_context, _options) {
        const rollMode = game.settings.get(SME_SETTING_NS, SME_ROLLMODE_KEY);
        const showPicker = rollMode === "unset" || this._showPicker;

        if (showPicker) {
            return this._renderPicker();
        }
        return this._renderRoller(rollMode);
    }

    _renderPicker() {
        const container = document.createElement("div");
        container.className = "sme-window";
        container.innerHTML = `
            <div class="sme-title">Choose Roll Mode</div>
            <div class="sme-picker">
                <div class="sme-picker-option" data-mode="d6-only">
                    <div class="sme-picker-label">Classic style: 1d6 only</div>
                    <div class="sme-picker-desc">
                        Roll 1d6 every other round. An encounter occurs on a 1. Roll on noise rounds too.
                    </div>
                </div>
                <div class="sme-picker-option" data-mode="both">
                    <div class="sme-picker-label">Lazy style: 1d12 and 1d6</div>
                    <div class="sme-picker-desc">
                        Roll 1d12 every round. No need to track which rounds to roll on. An encounter occurs on a 1. Use 1d6 when the party made noise.
                    </div>
                </div>
            </div>
        `;
        return container;
    }

    _renderRoller(rollMode) {
        const penalty = game.settings.get(SME_SETTING_NS, SME_SETTING_KEY);
        const d6Only = rollMode === "d6-only";

        const container = document.createElement("div");
        container.className = `sme-window${penalty > 0 ? " sme-penalty-active" : ""}`;

        const d6BtnClass = d6Only ? "sme-btn-primary" : "sme-btn-secondary";
        const d6Label = d6Only ? "Roll Encounter Check" : "1d6 — Characters Made Noise";

        container.innerHTML = `
            <div class="sme-title">Random Encounter</div>
            <div class="sme-button-grid">
                ${d6Only ? "" : `
                <button type="button" class="sme-btn-primary" data-roll="1d12" data-label="Normal Check">
                    1d12 — Normal Check
                </button>`}
                <button type="button" class="${d6BtnClass}" data-roll="1d6" data-label="${d6Only ? "Encounter Check" : "Made Noise"}">
                    ${d6Label}
                </button>
                <button type="button" class="sme-btn-debug" data-roll="1d1" data-label="Encounter">
                    1 — Roll an encounter now
                </button>
            </div>
            <div class="sme-penalty-panel">
                Encounter table modifier:
                <select data-action="set-penalty" class="sme-penalty-select">
                    <option value="0" ${penalty === 0 ? 'selected' : ''}>0</option>
                    <option value="2" ${penalty === 2 ? 'selected' : ''}>−2</option>
                    <option value="4" ${penalty === 4 ? 'selected' : ''}>−4</option>
                    <option value="6" ${penalty === 6 ? 'selected' : ''}>−6</option>
                    <option value="8" ${penalty === 8 ? 'selected' : ''}>−8</option>
                </select>
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

        const rollMode = game.settings.get(SME_SETTING_NS, SME_ROLLMODE_KEY);
        const showPicker = rollMode === "unset" || this._showPicker;

        // Inject header buttons (help + cog) — only when showing the roller.
        this._injectHeaderButtons(root, showPicker);

        // --- Picker mode ---
        if (showPicker) {
            root.querySelectorAll(".sme-picker-option").forEach(btn => {
                btn.addEventListener("click", async (event) => {
                    event.preventDefault();
                    const mode = btn.dataset.mode;
                    await game.settings.set(SME_SETTING_NS, SME_ROLLMODE_KEY, mode);
                    this._showPicker = false;
                    this.render({ force: true });
                });
            });
            return;
        }

        // --- Roller mode ---
        root.querySelectorAll("button[data-roll]").forEach(button => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                await this._runCheck(button.dataset.roll, button.dataset.label);
            });
        });

        root.querySelector("select[data-action='set-penalty']")?.addEventListener("change", async (event) => {
            await game.settings.set(SME_SETTING_NS, SME_SETTING_KEY, Number(event.target.value));
            this.render();
        });
    }

    _injectHeaderButtons(root, showPicker) {
        const header = root.querySelector(".window-header");
        if (!header) return;

        // Remove old button so we can rebuild fresh each render.
        header.querySelector(".sme-header-btn")?.remove();

        if (showPicker) return;

        // Cog button — re-opens the style picker (which doubles as help).
        const cogBtn = document.createElement("button");
        cogBtn.type = "button";
        cogBtn.className = "sme-header-btn";
        cogBtn.title = "Change roll mode";
        cogBtn.innerHTML = '<i class="fas fa-cog"></i>';
        cogBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._showPicker = true;
            this.render({ force: true });
        });
        cogBtn.addEventListener("dblclick", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        header.appendChild(cogBtn);
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
        const penalty        = game.settings.get(SME_SETTING_NS, SME_SETTING_KEY);
        const tableRoll      = await new Roll("1d8").evaluate();
        const rawResult      = tableRoll.total;
        // Clamp to 1: results below 1 are treated as 1 per the module rules.
        const adjustedResult = Math.max(1, rawResult - penalty);
        const encounter      = ENCOUNTERS[adjustedResult - 1];
        const isMinotaur     = adjustedResult === 1;

        // Penalty update: reset on Minotaur, otherwise increment for next roll.
        // First roll uses stored 0 (no penalty), subsequent rolls accumulate.
        const newPenalty = isMinotaur ? 0 : penalty + 2;
        await game.settings.set(SME_SETTING_NS, SME_SETTING_KEY, newPenalty);

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

// --- Registration --------------------------------------------------------------

Hooks.once("init", () => {
    // Register the penalty setting (world scope, shared between GMs).
    game.settings.register(SME_SETTING_NS, SME_SETTING_KEY, {
        name:  "Scarlet Minotaur Penalty",
        hint:  "Cumulative -2 per table roll since last Minotaur encounter (The Lost Citadel).",
        scope:  "world",
        config: false,
        type:   Number,
        default: 0
    });

    // Register the roll mode setting. "unset" triggers the first-run picker.
    game.settings.register(SME_SETTING_NS, SME_ROLLMODE_KEY, {
        name:    "Encounter Roll Mode",
        hint:    "Whether to show both 1d12+1d6 buttons or 1d6 only.",
        scope:   "world",
        config:  false,
        type:    String,
        default: "unset"
    });

    const module = game.modules.get(SME_MODULE_ID);
    module.api ??= {};
    module.api.scarletMinotaurEncounter = new ScarletMinotaurEncounterApp();
});
