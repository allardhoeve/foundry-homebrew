import { CRAWLING_CLOCK_D20 } from "./crawling-clock-d20.js";

// The Crawling Clock — a shared, player-visible dungeon timer.
//
// A counter starts at 20. Any player rolls a die (default 1d6) and the result is
// subtracted. At 0 the dungeon stirs; the GM handles the actual encounter.
//
// Division of labour:
//   - The world setting `crawlingClockValue` is the truth. Only the active GM writes it.
//   - The socket payload is the moment: it makes every open widget move at once,
//     without waiting on a database write.
//   - Anything that missed a payload (widget closed, reload, late join) self-heals by
//     snapping to the stored value on the next repaint.

const CC_MODULE_ID = "foundry-homebrew";
const CC_NS = "foundry-homebrew";
const CC_SOCKET = `module.${CC_MODULE_ID}`;

const CC_VALUE_KEY = "crawlingClockValue";
const CC_DIE_KEY = "crawlingClockDie";

// The clock is a d20 and starts at 20. Not configurable: any other number would make
// the die on the widget a lie. What the GM can change is the die that decrements it.
const CC_CLOCK_MAX = 20;

// --- Module-scope helpers ------------------------------------------------------
//
// The socket handler lives here, not on the Application. The GM must keep persisting
// the clock with the widget closed.

function ccApp() {
    return game.modules.get(CC_MODULE_ID)?.api?.crawlingClock;
}

// JSL Blackletter has old-style figures: 3 4 5 7 9 drop below the baseline, 6 rises
// above it and 8 rises further still. Every number therefore shares a baseline but its
// *ink* sits somewhere different — measured across 0-20, the ink centre swings by a
// quarter of the type size, which is why 5 hangs out of the die's facet and 8 rides high.
//
// Classifying by the extremes among the digits present gives six cases, whatever the
// number: the stylesheet holds the matching nudge that drops each one onto the facet's
// centre. Six covers any number of any length, not just 0-20.
const CC_TALL_FIGURES = "8";
const CC_RISING_FIGURES = "6";
const CC_DROPPING_FIGURES = "34579";

function ccFigureClass(value) {
    const digits = [...String(value)];
    const rise = digits.some(d => CC_TALL_FIGURES.includes(d)) ? "tall"
        : digits.some(d => CC_RISING_FIGURES.includes(d)) ? "rising"
        : "even";
    const drop = digits.some(d => CC_DROPPING_FIGURES.includes(d)) ? "drop" : "flat";
    return `crawling-clock__value--${rise}-${drop}`;
}

function ccStoredValue() {
    return game.settings.get(CC_NS, CC_VALUE_KEY);
}

// Runs on every client that receives a roll, including the roller (sockets do not
// loop back, so the roller calls this directly with the same payload).
function ccHandleRoll(payload) {
    const { rolled, userId } = payload;

    const app = ccApp();
    if (app?.rendered) app.applyRoll(rolled, userId);

    if (game.users.activeGM === game.user) ccPersistRoll(rolled, userId);
}

// Only the active GM gets here, so the setting is written once and the whisper is
// created once.
async function ccPersistRoll(rolled, userId) {
    const next = Math.max(0, ccStoredValue() - rolled);
    await game.settings.set(CC_NS, CC_VALUE_KEY, next);

    const name = game.users.get(userId)?.name ?? "Someone";
    await ChatMessage.create({
        content: `${name} rolled ${rolled}. Clock: ${next}.`,
        whisper: [game.user.id]
    });

    if (next === 0) {
        await ChatMessage.create({ content: "The dungeon stirs." });
    }
}

// --- Application ---------------------------------------------------------------

class CrawlingClockApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "crawling-clock",
        window: {
            title: "The Crawling Clock",
            resizable: false,
            minimizable: true
        },
        position: { width: 260 }
    }, { inplace: false });

    // What this client last painted. Null means "read the stored value".
    _displayed = null;

    // Local, ephemeral: { name, rolled } from the last payload seen.
    _lastRoll = null;

    toggleInterface() {
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
        }
    }

    // Live path: a roll arrived. Tick down from what we last painted.
    applyRoll(rolled, userId) {
        const current = this._displayed ?? ccStoredValue();
        this._displayed = Math.max(0, current - rolled);
        this._lastRoll = {
            name: game.users.get(userId)?.name ?? "Someone",
            rolled
        };
        this.render();
    }

    // Reconcile path: the stored value wins. Guarded by `rendered` at the call site.
    syncValue(value) {
        this._displayed = value;
        this.render();
    }

    async _renderHTML(_context, _options) {
        const value = this._displayed ?? ccStoredValue();
        this._displayed = value;

        const die = game.settings.get(CC_NS, CC_DIE_KEY);

        const rollLine = this._lastRoll
            ? `${this._lastRoll.name} rolled ${this._lastRoll.rolled}`
            : "&nbsp;";

        const stirs = value === 0
            ? `<div class="crawling-clock__stirs">The dungeon stirs.</div>`
            : "";

        const gmControls = game.user.isGM
            ? `<div class="crawling-clock__gm">
                   <button type="button" data-cc-action="down">&minus;</button>
                   <button type="button" data-cc-action="up">+</button>
                   <button type="button" data-cc-action="reset">Reset</button>
               </div>`
            : "";

        // State lives on the container so the die and the number restyle together.
        let stateClass = "";
        if (value === 0) stateClass = " crawling-clock--stirs";
        else if (value <= 6) stateClass = " crawling-clock--low";

        const container = document.createElement("div");
        container.innerHTML = `<div class="crawling-clock${stateClass}">
            <div class="crawling-clock__die">
                ${CRAWLING_CLOCK_D20}
                <div class="crawling-clock__value ${ccFigureClass(value)}">${value}</div>
            </div>
            ${stirs}
            <div class="crawling-clock__roll-line">${rollLine}</div>
            <button type="button" class="crawling-clock__roll" data-cc-action="roll"
                    ${value === 0 ? "disabled" : ""}>Roll ${die}</button>
            ${gmControls}
        </div>`;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (!root) return;

        root.querySelectorAll("[data-cc-action]").forEach(button => {
            button.addEventListener("click", () => this._onAction(button.dataset.ccAction));
        });
    }

    async _onClose(options) {
        await super._onClose(options);
        // Reopening should show the truth, not whatever this client last painted.
        this._displayed = null;
        this._lastRoll = null;
    }

    async _onAction(action) {
        switch (action) {
            case "roll":
                return this._onRoll();
            case "reset":
                return game.settings.set(CC_NS, CC_VALUE_KEY, CC_CLOCK_MAX);
            case "up":
                return game.settings.set(CC_NS, CC_VALUE_KEY, Math.min(CC_CLOCK_MAX, ccStoredValue() + 1));
            case "down":
                return game.settings.set(CC_NS, CC_VALUE_KEY, Math.max(0, ccStoredValue() - 1));
        }
    }

    async _onRoll() {
        const die = game.settings.get(CC_NS, CC_DIE_KEY);
        const roll = await new Roll(die).evaluate();

        const payload = { action: "roll", rolled: roll.total, userId: game.user.id };
        game.socket.emit(CC_SOCKET, payload);
        ccHandleRoll(payload);
    }
}

// --- Registration --------------------------------------------------------------

Hooks.once("init", () => {
    game.settings.register(CC_NS, CC_VALUE_KEY, {
        name: "Crawling Clock Value",
        scope: "world",
        config: false,
        type: Number,
        default: CC_CLOCK_MAX,
        onChange: value => {
            const app = ccApp();
            if (app?.rendered) app.syncValue(value);
        }
    });

    game.settings.register(CC_NS, CC_DIE_KEY, {
        name: "Crawling Clock: Die",
        hint: "The die rolled each round and subtracted from the clock.",
        scope: "world",
        config: true,
        type: String,
        default: "1d6"
    });

    const module = game.modules.get(CC_MODULE_ID);
    module.api ??= {};
    module.api.crawlingClock = new CrawlingClockApp();
});

Hooks.once("ready", () => {
    game.socket.on(CC_SOCKET, payload => {
        if (payload?.action === "roll") ccHandleRoll(payload);
    });
});
