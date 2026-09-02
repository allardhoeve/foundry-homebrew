import { CRAWLING_CLOCK_D20 } from "./crawling-clock-d20.js";

// The Crawling Clock — a shared, player-visible dungeon timer.
//
// A counter starts at 20. Any player rolls a die (default 1d6) and the result is
// subtracted. At 0 the dungeon stirs; the GM handles the actual encounter.
//
// Division of labour, and why it cannot be flattened:
//   - The world setting `crawlingClockValue` is the truth, and Foundry makes world
//     settings read-only to players. Only the active GM can write it, so a player's
//     click can never reach the truth on its own.
//   - Hence the socket. It is the only route from the player who clicked to the GM who
//     can persist, and on the way it moves every open widget at once. It is a relay,
//     not a latency optimisation over a write the player could have made instead: there
//     is no such write. Removing it does not simplify the clock, it breaks it.
//   - Anything that missed a payload (widget closed, reload, late join) self-heals by
//     snapping to the stored value on the next repaint.

// Also the settings namespace: Foundry scopes a module's settings under its id.
const CC_MODULE_ID = "foundry-homebrew";
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
// *ink* sits somewhere different, so centring the text box leaves the number visibly
// off-centre on the die's facet.
//
// The clock only ever shows 0-20, so each value gets its own class and the stylesheet
// holds a position (and where needed a size) fitted to that exact number. See the table
// in crawling-clock.css for how those were derived.
function ccFigureClass(value) {
    return `crawling-clock__value--v${value}`;
}

function ccStoredValue() {
    return game.settings.get(CC_MODULE_ID, CC_VALUE_KEY);
}

// Runs on every client that receives a roll, including the roller (sockets do not
// loop back, so the roller calls this directly with the same payload).
function ccHandleRoll(payload) {
    const { roll, userId } = payload;

    // Serialised rolls carry their total, so moving the widget costs no deserialisation.
    // Only the GM, who has to build the chat message, rebuilds the Roll itself.
    const app = ccApp();
    if (app?.rendered) app.applyRoll(roll.total, userId);

    if (game.users.activeGM === game.user) ccPersistRoll(roll, userId);
}

// Every write to the clock goes through here, GM controls included, so reaching zero
// announces itself however it was reached. Only a GM ever gets here.
//
// A write that changes nothing is dropped rather than sent: it saves the round trip,
// and it stops the GM's minus at 0 announcing the stirring a second time.
async function ccSetValue(next) {
    if (next === ccStoredValue()) return;

    await game.settings.set(CC_MODULE_ID, CC_VALUE_KEY, next);
    if (next === 0) await ChatMessage.create({ content: "The dungeon stirs." });
}

// Only the active GM gets here, so the setting is written once and the roll is posted
// once.
//
// The message is the clock's audit trail, and it is how anyone with the widget closed
// follows the descent. It is a real roll message so the dice stay inspectable, and the
// flavor says the whole thing in words so the log reads without expanding anything.
//
// The GM posts it on the roller's behalf. Only a GM can write the setting, so only a GM
// knows the resulting value at the moment of writing; letting the player post it would
// mean publishing their optimistic guess as the record. `author` makes it read as theirs
// all the same (BaseChatMessage#canCreate lets a GM, and only a GM, do this).
async function ccPersistRoll(rollData, userId) {
    const next = Math.max(0, ccStoredValue() - rollData.total);
    const name = game.users.get(userId)?.name ?? "Someone";
    const roll = Roll.fromData(rollData);

    // "public" against the GM's own chat mode: a private audit trail is not one.
    await roll.toMessage({
        author: userId,
        flavor: `The Crawling Clock: ${name} rolled a ${rollData.total}. There is now ${next} left.`
    }, { messageMode: "public" });

    await ccSetValue(next);
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
    //
    // The roll line says how the clock came to read what it reads. If the stored value
    // agrees with what we painted, this is the write catching up with a roll we already
    // showed and the line still holds. If it disagrees, the clock moved for some other
    // reason — a GM reset or nudge — and the line now describes a number that is gone.
    syncValue(value) {
        if (value !== this._displayed) this._lastRoll = null;
        this._displayed = value;
        this.render();
    }

    async _renderHTML(_context, _options) {
        // Remember what went on screen: syncValue compares against it to tell a roll
        // catching up from a clock that moved underneath us.
        const value = this._displayed ?? ccStoredValue();
        this._displayed = value;

        const die = game.settings.get(CC_MODULE_ID, CC_DIE_KEY);

        // Empty when there is nothing to say; the stylesheet holds the line's height
        // open so the widget does not resize under the button.
        const rollLine = this._lastRoll
            ? `${this._lastRoll.name} rolled ${this._lastRoll.rolled}`
            : "";

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

        this.element.querySelectorAll("[data-cc-action]").forEach(button => {
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
                return ccSetValue(CC_CLOCK_MAX);
            case "up":
                return ccSetValue(Math.min(CC_CLOCK_MAX, ccStoredValue() + 1));
            case "down":
                return ccSetValue(Math.max(0, ccStoredValue() - 1));
        }
    }

    async _onRoll() {
        const die = game.settings.get(CC_MODULE_ID, CC_DIE_KEY);

        // The die is free text a GM typed. A bad formula must not take the button down
        // with it, and the player who clicked deserves to know why nothing happened.
        let roll;
        try {
            roll = await new Roll(die).evaluate();
        } catch {
            ui.notifications.error(`The Crawling Clock die "${die}" is not a roll formula.`);
            return;
        }

        const payload = { action: "roll", roll: roll.toJSON(), userId: game.user.id };
        game.socket.emit(CC_SOCKET, payload);
        ccHandleRoll(payload);
    }
}

// --- Registration --------------------------------------------------------------

Hooks.once("init", () => {
    game.settings.register(CC_MODULE_ID, CC_VALUE_KEY, {
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

    game.settings.register(CC_MODULE_ID, CC_DIE_KEY, {
        name: "Crawling Clock: Die",
        hint: "The die rolled each round and subtracted from the clock.",
        scope: "world",
        config: true,
        type: String,
        default: "1d6",
        // onChange lands on every client. The warning is for the GM who typed it; the
        // repaint is for everyone, so no one is left looking at a button advertising the
        // old die. Both reads of the setting are live, so the roll was always correct
        // even when the label was stale, which is why this is a cosmetic fix and not a
        // behavioural one.
        onChange: die => {
            if (game.user.isGM && !Roll.validate(die)) {
                ui.notifications.warn(`"${die}" is not a roll formula. The Crawling Clock cannot be rolled until it is.`);
            }

            const app = ccApp();
            if (app?.rendered) app.render();
        }
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
