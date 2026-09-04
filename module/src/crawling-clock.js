import {
    CRAWLING_CLOCK_D20_VALUES,
    CRAWLING_CLOCK_D20_MIN,
    CRAWLING_CLOCK_D20_MAX
} from "./crawling-clock-d20.js";

// The Crawling Clock — a shared, player-visible dungeon timer.
//
// A counter starts at 20. Any player rolls a die (default 1d6) and the result is
// subtracted. At 1 the dungeon stirs; the GM handles the actual encounter.
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

// The clock is a d20, so it runs across the die's own faces: 20 down to 1, one value per
// face. Not configurable — any other range would make the die on the widget a lie — and
// taken from the die itself so the two can never drift apart. What the GM can change is
// the die that decrements it.
//
// The floor is 1 rather than 0 because 1 is where the encounter happens, and because a
// twenty-faced die has no face to show a 0 on.
const CC_CLOCK_MAX = CRAWLING_CLOCK_D20_MAX;
const CC_CLOCK_MIN = CRAWLING_CLOCK_D20_MIN;

// The dice the cogwheel offers. The setting itself stays free text, because a GM who
// wants 2d4 should still be able to type it in the module settings; these are the ones
// worth reaching for mid-session without leaving the table.
const CC_DIE_PRESETS = ["1d3", "1d4", "1d6", "1d8", "1d10", "1d12"];

// Where the clock starts to look dangerous: a fifth of the way from the top, and low
// enough that one roll of the default die could end it.
const CC_CLOCK_LOW = 6;

// Carried by the numeral on whichever face is turned towards us. The states colour that
// one and leave the other nineteen alone: a die whose whole rim goes red is not a signal,
// it is a repaint.
const CC_CURRENT = "crawling-clock__value--current";

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
// The clock only ever shows 1-20, so each value gets its own class and the stylesheet
// holds a position (and where needed a size) fitted to that exact number. See the table
// in crawling-clock.css for how those were derived.
function ccFigureClass(value) {
    return `crawling-clock__value--v${value}`;
}

// Clamped on the way out, because the stored value predates the floor moving to 1: a
// world that was already sitting on 0 would otherwise ask the die to show a face it does
// not have. The next write settles it for good.
function ccStoredValue() {
    const stored = game.settings.get(CC_MODULE_ID, CC_VALUE_KEY);
    return Math.min(CC_CLOCK_MAX, Math.max(CC_CLOCK_MIN, stored));
}

// The die's twenty faces, each carrying its own number, and the body turned to bring
// `value` to the front. Every transform lives in crawling-clock-d20.css; this only picks
// which orientation class the body wears.
function ccDieMarkup(value) {
    const faces = CRAWLING_CLOCK_D20_VALUES.map((number, face) =>
        `<div class="cc-d20-3d__face cc-d20-3d__face--f${face}">
             <div class="cc-d20-3d__plate"></div>
             <div class="crawling-clock__value ${ccFigureClass(number)}">${number}</div>
         </div>`).join("");

    return `<div class="cc-d20-3d">
                <div class="cc-d20-3d__body cc-d20-3d__body--to${value}">${faces}</div>
            </div>`;
}

// What the cogwheel's picker offers, given what the clock is currently rolling.
//
// The presets, plus the current die when it is not one of them. The setting is free text
// and a GM may well have typed 2d4 into the module settings; dropping it here would make
// the picker misreport what the clock is rolling, and picking any option would silently
// discard their formula.
function ccDieOptions(die) {
    return CC_DIE_PRESETS.includes(die) ? CC_DIE_PRESETS : [...CC_DIE_PRESETS, die];
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

// Every write to the clock goes through here, GM controls included, so reaching the
// floor announces itself however it was reached. Only a GM ever gets here.
//
// A write that changes nothing is dropped rather than sent: it saves the round trip,
// and it stops the GM's minus at 1 announcing the stirring a second time.
async function ccSetValue(next) {
    if (next === ccStoredValue()) return;

    await game.settings.set(CC_MODULE_ID, CC_VALUE_KEY, next);
    if (next === CC_CLOCK_MIN) await ChatMessage.create({ content: "The dungeon stirs." });
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
    const next = Math.max(CC_CLOCK_MIN, ccStoredValue() - rollData.total);
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

    // Whether the GM's die picker is showing. Local and GM-only.
    _settingsOpen = false;

    toggleInterface() {
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
        }
    }

    // Live path: a roll arrived. Tick down from what we last painted and turn the die
    // onto the new face. Guarded by `rendered` at the call site.
    applyRoll(rolled, userId) {
        this._displayed = Math.max(CC_CLOCK_MIN, (this._displayed ?? ccStoredValue()) - rolled);
        this._lastRoll = {
            name: game.users.get(userId)?.name ?? "Someone",
            rolled
        };
        this._paint();
    }

    // Reconcile path: the stored value wins. Guarded by `rendered` at the call site.
    //
    // The roll line says how the clock came to read what it reads. If the stored value
    // agrees with what we painted, this is the GM's write catching up with a roll we
    // already showed: there is nothing to reconcile and the line still holds. Returning
    // here is not an optimisation. Every roll ends with that write landing back on every
    // client, the roller included, a few tens of milliseconds later, and re-applying the
    // same face would restart the turn from where it had got to.
    //
    // A value that disagrees means the clock moved for some other reason, a GM reset or
    // nudge, and the line now describes a number that is gone.
    syncValue(value) {
        if (value === this._displayed) return;

        this._lastRoll = null;
        this._displayed = value;
        this._paint();
    }

    // The widget's shape. Everything that follows the value (which face is forward, the
    // state colours, the roll line, whether the button is live) is left to _paint, which
    // runs once here and again on every change afterwards.
    //
    // The die goes in already facing the current value so that opening the widget is not
    // an animation. From then on the element stays put and _paint turns it.
    async _renderHTML(_context, _options) {
        // Remember what went on screen: syncValue compares against it to tell a write
        // catching up from a clock that moved underneath us.
        const value = this._displayed ?? ccStoredValue();
        this._displayed = value;

        const die = game.settings.get(CC_MODULE_ID, CC_DIE_KEY);

        const gmControls = game.user.isGM
            ? `<div class="crawling-clock__gm">
                   <button type="button" data-cc-action="down">&minus;</button>
                   <button type="button" data-cc-action="up">+</button>
                   <button type="button" data-cc-action="reset">Reset</button>
               </div>`
            : "";

        // Only a GM can write a world setting, so only a GM is offered the picker. The
        // select carries its own accessible name: a visible label would be the one thing
        // in the panel not on the same column as the buttons above it.
        const settings = game.user.isGM && this._settingsOpen
            ? `<div class="crawling-clock__settings">
                   <select data-cc-die aria-label="Die">
                       ${ccDieOptions(die).map(d => `<option value="${d}"${d === die ? " selected" : ""}>${d}</option>`).join("")}
                   </select>
               </div>`
            : "";

        const container = document.createElement("div");
        container.innerHTML = `<div class="crawling-clock">
            <div class="crawling-clock__die">${ccDieMarkup(value)}</div>
            <div class="crawling-clock__stirs">The dungeon stirs.</div>
            <div class="crawling-clock__roll-line"></div>
            <button type="button" class="crawling-clock__roll" data-cc-action="roll">Roll ${die}</button>
            ${gmControls}
            ${settings}
        </div>`;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    // The cogwheel, built the way Foundry builds its own header buttons: the same
    // `header-control icon fa-solid` classes the frame gives the ellipsis and the close
    // button, and inserted *before* the close button, which is where core puts its own
    // supplemental controls (see BackupManager#_onFirstRender). Wearing those classes
    // means it takes the frame's own sizing, colour and hover for free rather than
    // needing a stylesheet to win an argument about it.
    //
    // Built here rather than in _onRender because ApplicationV2 replaces only the window
    // content: the header, and this button with it, outlives every repaint. Closing the
    // widget drops the frame and the next open counts as a first render again, so the
    // button comes back with it.
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        if (!game.user.isGM) return;

        const header = this.window?.header ?? this.element.querySelector(".window-header");
        if (!header) return;

        const cog = document.createElement("button");
        cog.type = "button";
        cog.className = "header-control icon fa-solid fa-cog crawling-clock__cog";
        cog.dataset.tooltip = "Choose the die";
        cog.setAttribute("aria-label", "Choose the die");
        cog.setAttribute("aria-expanded", String(this._settingsOpen));
        cog.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this._settingsOpen = !this._settingsOpen;
            cog.setAttribute("aria-expanded", String(this._settingsOpen));
            this.render();
        });
        // The header treats a double click as "maximise"; swallow it so a quick second
        // click on the cog does not resize the window.
        cog.addEventListener("dblclick", event => {
            event.preventDefault();
            event.stopPropagation();
        });

        // Not `before(cog) ?? append(cog)`: before() returns undefined, so the fallback
        // fires every time and appends the button it just placed, landing it past the
        // close control again.
        const close = header.querySelector("button[data-action=close]");
        if (close) close.before(cog);
        else header.append(cog);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        this.element.querySelectorAll("[data-cc-action]").forEach(button => {
            button.addEventListener("click", () => this._onAction(button.dataset.ccAction));
        });

        // Writing a world setting is a GM-only act, and the picker is only rendered for a
        // GM, so this listener can only ever be reached by one.
        this.element.querySelector("[data-cc-die]")?.addEventListener("change", event => {
            game.settings.set(CC_MODULE_ID, CC_DIE_KEY, event.target.value);
        });

        this._paint();
    }

    // Everything that follows the value, written onto the DOM that is already there.
    //
    // This is the only place the clock changes what it shows, and it is why a roll no
    // longer repaints the widget. The die element survives, so the browser has a resolved
    // transform to interpolate from and swapping the orientation class is a turn: for a
    // roll, and equally for a GM nudge, which is a die being moved and may as well look
    // like one. On the first render the class it writes is the one already there, so
    // opening the widget stays still.
    _paint() {
        const value = this._displayed;
        const root = this.element.querySelector(".crawling-clock");

        // One signal at a time (design guide): the numeral on the face turned towards us
        // carries the state, and the other nineteen stay parchment.
        root.querySelector(`.${CC_CURRENT}`)?.classList.remove(CC_CURRENT);
        root.querySelector(`.${ccFigureClass(value)}`).classList.add(CC_CURRENT);

        root.classList.toggle("crawling-clock--stirs", value === CC_CLOCK_MIN);
        root.classList.toggle("crawling-clock--low",
            value > CC_CLOCK_MIN && value <= CC_CLOCK_LOW);

        // Empty when there is nothing to say; the stylesheet holds the line's height
        // open so the widget does not resize under the button.
        root.querySelector(".crawling-clock__roll-line").textContent = this._lastRoll
            ? `${this._lastRoll.name} rolled ${this._lastRoll.rolled}`
            : "";

        // At the floor the Reset is the way forward, so the roll goes dead.
        root.querySelector(".crawling-clock__roll").disabled = value === CC_CLOCK_MIN;

        root.querySelector(".cc-d20-3d__body").className =
            `cc-d20-3d__body cc-d20-3d__body--to${value}`;
    }

    async _onClose(options) {
        await super._onClose(options);
        // Reopening should show the truth, not whatever this client last painted.
        this._displayed = null;
        this._lastRoll = null;
        this._settingsOpen = false;
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
                return ccSetValue(Math.max(CC_CLOCK_MIN, ccStoredValue() - 1));
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
