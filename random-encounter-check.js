// Shadowdark Random Encounter Check
// UI stays open and offers quick-roll buttons for different cadences.

// Grimdark messages for when an encounter occurs (roll of 1)
const encounterMessages = [
    "Something stirs in the darkness...",
    "The shadows grow hungry.",
    "Fate turns against you. Something approaches.",
    "The dungeon awakens. You are not alone.",
    "A chill runs down your spine. Too late to run.",
    "The darkness has noticed you.",
    "Dread footsteps echo in the black.",
    "The torch flickers. Something comes."
];

// Messages for avoiding an encounter (rolls 2-12)
const safeMessages = [
    "The darkness holds its breath. You pass unseen.",
    "Fortune favors you... for now.",
    "The shadows remain still. Continue onward.",
    "No eyes watch from the black. Yet.",
    "The dungeon sleeps. Tread carefully.",
    "You move like ghosts through the gloom.",
    "The fates grant you a moment's reprieve.",
    "Silence. The predators hunt elsewhere.",
    "Your luck holds. The dark is quiet.",
    "Nothing stirs. But stay vigilant.",
    "The torchlight wards away what lurks beyond."
];

// Pick a random message from the appropriate array
const getMessage = (arr) => arr[Math.floor(Math.random() * arr.length)];

class RandomEncounterCheckApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "random-encounter-check",
        window: {
            title: "Random Encounter Check",
            resizable: false,
            minimizable: true
        },
        position: {
            width: 360
        }
    });

    async _renderHTML(_context, _options) {
        const container = document.createElement("div");
        container.innerHTML = `
            <div style="padding: 10px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    Roll this every round. Choose how dangerous the dungeon is below. Normally you'd roll 
                    every 1, 2, or 3 rounds. With this macro you can run it every round. The dice are adjusted
                    to 1d6, 1d12 and 1d18 to accommodate for this.
                </div>
                <div style="display: grid; gap: 8px;">
                    <button type="button" data-roll="1d6" data-label="Deadly">
                        1d6 — Deadly
                    </button>
                    <button type="button" data-roll="1d12" data-label="Dangerous">
                        1d12 — Dangerous
                    </button>
                    <button type="button" data-roll="1d18" data-label="Unsafe">
                        1d18 — Unsafe
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

        const buttons = Array.from(root.querySelectorAll("button[data-roll]"));
        buttons.forEach((button) => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                const die = button.dataset.roll;
                const label = button.dataset.label;
                await this._runCheck(die, label);
            });
        });
    }

    async _runCheck(die, label) {
        const roll = await new Roll(die).evaluate();
        const result = roll.total;

        let messageContent;

        if (result === 1) {
            // Encounter occurs - red and ominous
            const encounterMsg = getMessage(encounterMessages);
            messageContent = `
                <div style="text-align: center; padding: 10px;">
                    <div style="font-size: 14px; font-weight: bold; color: #666; margin-bottom: 5px;">
                        RANDOM ENCOUNTER CHECK
                    </div>
                    <div style="font-size: 12px; color: #777; margin-bottom: 6px;">
                        ${die} — ${label}
                    </div>
                    <div style="font-size: 48px; font-weight: bold; color: #8B0000; text-shadow: 0 0 10px #ff0000;">
                        ${result}
                    </div>
                    <div style="font-size: 16px; font-weight: bold; color: #8B0000; margin-top: 10px; font-style: italic;">
                        ⚔️ A RANDOM ENCOUNTER OCCURS! ⚔️
                    </div>
                    <div style="font-size: 13px; color: #aa0000; margin-top: 8px; font-style: italic;">
                        "${encounterMsg}"
                    </div>
                </div>
            `;
        } else {
            // No encounter - muted and relieved
            const safeMsg = getMessage(safeMessages);
            messageContent = `
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
                        "${safeMsg}"
                    </div>
                </div>
            `;
        }

        // Send as a private GM message (whisper to self)
        ChatMessage.create({
            user: game.user.id,
            content: messageContent,
            whisper: [game.user.id],
            blind: true,
            speaker: { alias: "The Darkness" }
        });
    }
}

if (!game.randomEncounterCheckApp) {
    game.randomEncounterCheckApp = new RandomEncounterCheckApp();
}

game.randomEncounterCheckApp.render({ force: true });
