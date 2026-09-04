import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// The widget's own logic, exercised against a stubbed Foundry. Everything here is a
// decision the code makes internally, how far the clock may fall and which changes are
// worth putting on screen, so none of it is reachable from the UI and all of it can break
// without anything looking wrong.
//
// _paint() is the seam. It is the only method that touches the DOM, so stubbing it out
// leaves the state transitions testable in Node and counts the repaints at the same time.

const MODULE_ID = "foundry-homebrew";
const SOURCE = new URL("../../module/src/crawling-clock.js", import.meta.url);

let loads = 0;

// A fresh copy of the module each time. It keeps its state in module scope and hands the
// widget to `game.modules` from its init hook, so the only way to get a clean one is to
// re-import it past the ESM cache.
async function loadClock({ stored = 20 } = {}) {
    const settings = new Map();
    const hooks = new Map();
    const paints = { count: 0 };

    globalThis.Hooks = { once: (name, fn) => hooks.set(name, fn) };

    globalThis.foundry = {
        applications: {
            api: {
                ApplicationV2: class {
                    static DEFAULT_OPTIONS = {};
                    rendered = true;
                    render() {}
                }
            }
        },
        utils: { mergeObject: (a, b) => ({ ...a, ...b }) }
    };

    globalThis.game = {
        modules: new Map([[MODULE_ID, {}]]),
        users: { get: () => ({ name: "Player2" }), activeGM: null },
        user: { id: "u1", isGM: false },
        settings: {
            register: (_ns, key, config) => settings.set(key, { config, value: config.default }),
            get: (_ns, key) => settings.get(key).value,
            set: async (_ns, key, value) => {
                settings.get(key).value = value;
                await settings.get(key).config.onChange?.(value);
            }
        }
    };

    await import(`${SOURCE}?load=${loads++}`);
    hooks.get("init")();
    settings.get("crawlingClockValue").value = stored;

    const app = game.modules.get(MODULE_ID).api.crawlingClock;
    app._paint = () => { paints.count++; };

    return { app, paints, settings };
}

describe("the Crawling Clock widget", () => {
    let app, paints;

    beforeEach(async () => {
        ({ app, paints } = await loadClock());
    });

    describe("rolling down", () => {
        it("subtracts the roll from what it last painted", () => {
            app.applyRoll(6, "u1");
            assert.equal(app._displayed, 14);
        });

        it("stops at 1 rather than running past the die's faces", () => {
            app._displayed = 3;
            app.applyRoll(6, "u1");
            assert.equal(app._displayed, 1);
        });

        it("reads the stored value when it has painted nothing yet", async () => {
            ({ app } = await loadClock({ stored: 12 }));
            app.applyRoll(4, "u1");
            assert.equal(app._displayed, 8);
        });

        // Worlds that ran before the floor moved to 1 can hold a stored 0, and there is
        // no face for it. Clamping on read keeps the die showable until the next write.
        it("clamps a stored value the die cannot show", async () => {
            ({ app } = await loadClock({ stored: 0 }));
            app.applyRoll(1, "u1");
            assert.equal(app._displayed, 1);
        });
    });

    describe("reconciling against the stored value", () => {
        // The regression this exists for: every roll ends with the GM persisting it,
        // which lands back on every client, the roller included, a few tens of
        // milliseconds later. Painting on that would write the die's orientation class a
        // second time and restart the turn from wherever it had got to.
        it("does not repaint when the write merely catches up with a roll", () => {
            app.applyRoll(6, "u1");
            const after = paints.count;

            app.syncValue(14);

            assert.equal(paints.count, after, "the catching-up write repainted");
            assert.equal(app._displayed, 14);
        });

        it("keeps the roll line, which still describes how the clock got there", () => {
            app.applyRoll(6, "u1");
            app.syncValue(14);
            assert.deepEqual(app._lastRoll, { name: "Player2", rolled: 6 });
        });

        it("repaints when the clock moved for some other reason", () => {
            app.applyRoll(6, "u1");
            const after = paints.count;

            app.syncValue(20);

            assert.equal(paints.count, after + 1);
            assert.equal(app._displayed, 20);
        });

        it("drops the roll line when the number it described is gone", () => {
            app.applyRoll(6, "u1");
            app.syncValue(20);
            assert.equal(app._lastRoll, null);
        });
    });
});
