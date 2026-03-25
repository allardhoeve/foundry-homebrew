// Lost Citadel: Scarlet Minotaur Random Encounter Check
//
// Two-step encounter check for The Lost Citadel dungeon:
//   1. Roll 1d12 (normal) or 1d6 (noisy) — on a 1, roll the encounter table.
//   2. Encounter table is d8 with a cumulative -2 Minotaur penalty (see design doc).
//
// Persistent state: the current penalty is stored in game.settings (world scope)
// so it survives refreshes and is shared between GMs.
//
// Results are shown in the app window only — the GM decides how to communicate
// encounters to players.

import { ENCOUNTERS, resolveEncounter, resolveDistance, resolveActivity, resolveReaction } from "./encounter-math.js";

// --- Settings ------------------------------------------------------------------

const SME_MODULE_ID = "foundry-homebrew";
const SME_SETTING_NS  = "lost-citadel-macros";
const SME_SETTING_KEY = "minotaurPenalty";
const SME_ROLLMODE_KEY = "rollMode";

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
        if (this._pendingRoll) {
            return this._renderResults();
        }

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

    _renderResults() {
        const data = this._pendingRoll;
        const container = document.createElement("div");
        container.className = "sme-window sme-results";

        // Build encounter list rows
        const rows = data.encounters.map((text, i) => {
            const index = i + 1; // 1-based
            const isSelected = index === data.selectedIndex;
            const isUnreachable = index > Math.max(1, 8 - data.penalty);
            const isMinotaur = index === 1;
            let cls = "sme-results__row";
            if (isSelected) cls += " sme-results__row--selected";
            if (isUnreachable) cls += " sme-results__row--unreachable";
            if (isMinotaur) cls += " sme-results__row--minotaur";
            // TODO(task-023): encounter text will come from compendium — sanitize
            // before inserting into innerHTML to prevent XSS.
            return `<div class="${cls}" data-index="${index}">${text}</div>`;
        }).join("");

        // Roll breakdown
        const sign = data.penalty > 0 ? ` − ${data.penalty}` : "";
        const rollInfo = `d8: ${data.rawD8}${sign} → ${data.adjustedResult}`;

        // Sub-rolls summary
        const subRolls = [
            `Distance: ${data.distance.label} (${data.distance.roll})`,
            `Activity: ${data.activity.label} (${data.activity.roll})`,
            `Reaction: ${data.reaction.label} (${data.reaction.roll})`,
            `Treasure: ${data.treasure ? "Yes" : "No"}`
        ].join(" · ");

        container.innerHTML = `
            <div class="sme-title">Encounter</div>
            <div class="sme-results__info">${rollInfo}</div>
            <div class="sme-results__list">${rows}</div>
            <div class="sme-results__subrolls">${subRolls}</div>
            <button type="button" class="sme-btn-primary sme-results__done">Done</button>
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

        // --- Results panel mode ---
        if (this._pendingRoll) {
            this._injectHeaderButtons(root, false);

            root.querySelectorAll(".sme-results__row").forEach(row => {
                row.addEventListener("click", (event) => {
                    event.preventDefault();
                    this._pendingRoll.selectedIndex = Number(row.dataset.index);
                    this.render({ force: true });
                });
            });

            root.querySelector(".sme-results__done")?.addEventListener("click", async (event) => {
                event.preventDefault();
                const isMinotaur = this._pendingRoll.selectedIndex === 1;
                const currentPenalty = this._pendingRoll.penalty;
                const newPenalty = isMinotaur ? 0 : currentPenalty + 2;
                await game.settings.set(SME_SETTING_NS, SME_SETTING_KEY, newPenalty);
                this._pendingRoll = null;
                this.render({ force: true });
            });
            return;
        }

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
    async _runCheck(die) {
        const roll   = await new Roll(die).evaluate();
        const result = roll.total;

        if (result === 1) {
            await this._rollEncounterTable();
        } else {
            // No encounter — GM sees the die result in the app window.
            this.render();
        }
    }

    // --- Encounter Table Roll --------------------------------------------------

    // Rolls 1d8 + sub-roll dice, stores pending state, and re-renders to show
    // the results panel. Penalty is updated when the GM clicks Done.
    //
    // Note: _pendingRoll intentionally survives window close — re-opening shows
    // the same roll so the GM doesn't lose context. When task-023 replaces
    // ENCOUNTERS with dynamic table lookup, the encounters array here may go
    // stale if the table changes between close and re-open.
    async _rollEncounterTable() {
        const penalty = game.settings.get(SME_SETTING_NS, SME_SETTING_KEY);

        const [tableRoll, distRoll, actRoll, reactRoll, treasureRoll] = await Promise.all([
            new Roll("1d8").evaluate(),
            new Roll("1d6").evaluate(),
            new Roll("2d6").evaluate(),
            new Roll("2d6").evaluate(),
            new Roll("1d2").evaluate()
        ]);

        const rawD8 = tableRoll.total;
        const { adjustedResult } = resolveEncounter(rawD8, penalty);

        this._pendingRoll = {
            rawD8,
            adjustedResult,
            penalty,
            selectedIndex: adjustedResult,
            encounters: ENCOUNTERS,
            distance: resolveDistance(distRoll.total),
            activity: resolveActivity(actRoll.total),
            reaction: resolveReaction(reactRoll.total),
            treasure: treasureRoll.total === 1
        };

        this.render({ force: true });
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
