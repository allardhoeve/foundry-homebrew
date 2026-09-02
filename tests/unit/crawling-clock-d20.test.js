import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    CRAWLING_CLOCK_D20_ART,
    CRAWLING_CLOCK_D20_VALUES,
    CRAWLING_CLOCK_D20_MIN,
    CRAWLING_CLOCK_D20_MAX
} from "../../module/src/crawling-clock-d20.js";

// Both halves of the die come out of tools/d20/generate-d20.py, and they have to agree:
// the JS says which number is on which face, the CSS says how to turn to it and how it
// catches the light. Nothing at runtime checks that. A regenerate that dropped a face,
// or a hand-edit to either file, would leave a die that renders perfectly and simply
// stops turning for some values — which is exactly the kind of silent break worth a test.

const CSS = readFileSync(
    fileURLToPath(new URL("../../module/styles/crawling-clock-d20.css", import.meta.url)),
    "utf8"
);

const FACES = 20;
const values = () => Array.from(
    { length: CRAWLING_CLOCK_D20_MAX - CRAWLING_CLOCK_D20_MIN + 1 },
    (_, i) => CRAWLING_CLOCK_D20_MIN + i
);

describe("the Crawling Clock d20", () => {
    it("has twenty faces of artwork", () => {
        assert.equal(CRAWLING_CLOCK_D20_ART.length, FACES);
        assert.equal(CRAWLING_CLOCK_D20_VALUES.length, FACES);
    });

    it("inks each of 1-20 on exactly one face", () => {
        assert.deepEqual([...CRAWLING_CLOCK_D20_VALUES].sort((a, b) => a - b), values());
    });

    it("covers the clock's whole range, so no value is ever unshowable", () => {
        assert.equal(CRAWLING_CLOCK_D20_MIN, 1);
        assert.equal(CRAWLING_CLOCK_D20_MAX, FACES);
    });

    it("draws every face as its own triangle plate", () => {
        for (const [face, art] of CRAWLING_CLOCK_D20_ART.entries()) {
            const plate = art.match(/class="cc-d20-3d__plate" points="([^"]+)"/);
            assert.ok(plate, `face ${face} has no plate`);
            assert.equal(plate[1].split(" ").length, 3, `face ${face} is not a triangle`);
        }
    });
});

describe("the generated die stylesheet", () => {
    it("places every face on the solid", () => {
        for (let face = 0; face < FACES; face++) {
            assert.match(CSS, new RegExp(`\\.cc-d20-3d__face--f${face} \\{ transform: matrix3d\\(`),
                `face ${face} has no transform`);
        }
    });

    it("can turn to every value the clock can hold", () => {
        for (const value of values()) {
            assert.match(CSS, new RegExp(`\\.cc-d20-3d__body--to${value} \\{ transform: matrix3d\\(`),
                `nothing to turn to for ${value}`);
        }
    });

    it("lights all twenty faces in every orientation", () => {
        for (const value of values()) {
            for (let face = 0; face < FACES; face++) {
                assert.match(
                    CSS,
                    new RegExp(`\\.cc-d20-3d__body--to${value} \\.cc-d20-3d__face--f${face}\\b`),
                    `face ${face} is unlit while the die shows ${value}`
                );
            }
        }
    });

    it("supplies every metric the hand-written stylesheet reads", () => {
        for (const metric of ["--cc-d20-perspective", "--cc-d20-inradius", "--cc-d20-face-w",
                              "--cc-d20-face-h", "--cc-d20-figure-scale", "--cc-d20-figure-top",
                              "--cc-d20-hatch-width", "--cc-d20-edge-width"]) {
            assert.ok(CSS.includes(`${metric}:`), `${metric} is missing`);
        }
    });
});

describe("the counter's per-value fitting", () => {
    const WIDGET_CSS = readFileSync(
        fileURLToPath(new URL("../../module/styles/crawling-clock.css", import.meta.url)),
        "utf8"
    );

    // Every number the clock can show needs a fitting entry, or it falls back to the
    // default shift and sits visibly off-centre on its facet.
    it("fits every value the die can land on", () => {
        for (const value of values()) {
            assert.match(WIDGET_CSS, new RegExp(`\\.crawling-clock__value--v${value}\\s`),
                `no fitting for ${value}`);
        }
    });
});
