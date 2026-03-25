import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ENCOUNTERS,
    resolveEncounter,
    resolveDistance,
    resolveActivity,
    resolveReaction
} from '../../module/src/encounter-math.js';

describe('resolveEncounter', () => {
    it('returns the correct encounter for a normal roll with no penalty', () => {
        const result = resolveEncounter(5, 0);
        assert.equal(result.adjustedResult, 5);
        assert.equal(result.encounter, ENCOUNTERS[4]);
        assert.equal(result.isMinotaur, false);
    });

    it('returns minotaur when d8 is 1 and penalty is 0', () => {
        const result = resolveEncounter(1, 0);
        assert.equal(result.adjustedResult, 1);
        assert.equal(result.isMinotaur, true);
        assert.equal(result.encounter, ENCOUNTERS[0]);
    });

    it('clamps to minotaur when penalty exceeds roll', () => {
        const result = resolveEncounter(3, 4);
        assert.equal(result.adjustedResult, 1);
        assert.equal(result.isMinotaur, true);
    });

    it('clamps to minotaur under extreme penalty', () => {
        const result = resolveEncounter(1, 8);
        assert.equal(result.adjustedResult, 1);
        assert.equal(result.isMinotaur, true);
    });

    it('returns the last table entry for max roll with no penalty', () => {
        const result = resolveEncounter(8, 0);
        assert.equal(result.adjustedResult, 8);
        assert.equal(result.encounter, ENCOUNTERS[7]);
        assert.equal(result.isMinotaur, false);
    });

    it('high roll absorbs penalty without hitting minotaur', () => {
        const result = resolveEncounter(8, 6);
        assert.equal(result.adjustedResult, 2);
        assert.equal(result.isMinotaur, false);
        assert.equal(result.encounter, ENCOUNTERS[1]);
    });

    it('accepts an explicit encounters parameter', () => {
        const custom = ["Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
        const result = resolveEncounter(3, 0, custom);
        assert.equal(result.encounter, "Gamma");
        assert.equal(result.adjustedResult, 3);
        assert.equal(result.isMinotaur, false);
    });

    it('uses explicit encounters for clamped result', () => {
        const custom = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
        const result = resolveEncounter(2, 4, custom);
        assert.equal(result.encounter, "First");
        assert.equal(result.isMinotaur, true);
    });
});

describe('resolveDistance', () => {
    it('returns Close for roll of 1', () => {
        assert.equal(resolveDistance(1).label, "Close");
        assert.equal(resolveDistance(1).roll, 1);
    });

    it('returns Near for roll of 2', () => {
        assert.equal(resolveDistance(2).label, "Near");
    });

    it('returns Near for roll of 4', () => {
        assert.equal(resolveDistance(4).label, "Near");
    });

    it('returns Far for roll of 5', () => {
        assert.equal(resolveDistance(5).label, "Far");
    });

    it('returns Far for roll of 6', () => {
        assert.equal(resolveDistance(6).label, "Far");
    });
});

describe('resolveActivity', () => {
    it('returns Hunting for roll of 2', () => {
        assert.equal(resolveActivity(2).label, "Hunting");
    });

    it('returns Hunting for roll of 4', () => {
        assert.equal(resolveActivity(4).label, "Hunting");
    });

    it('returns Eating for roll of 5', () => {
        assert.equal(resolveActivity(5).label, "Eating");
    });

    it('returns Eating for roll of 6', () => {
        assert.equal(resolveActivity(6).label, "Eating");
    });

    it('returns Building/nesting for roll of 7', () => {
        assert.equal(resolveActivity(7).label, "Building/nesting");
    });

    it('returns Building/nesting for roll of 8', () => {
        assert.equal(resolveActivity(8).label, "Building/nesting");
    });

    it('returns Socializing/playing for roll of 9', () => {
        assert.equal(resolveActivity(9).label, "Socializing/playing");
    });

    it('returns Socializing/playing for roll of 10', () => {
        assert.equal(resolveActivity(10).label, "Socializing/playing");
    });

    it('returns Guarding for roll of 11', () => {
        assert.equal(resolveActivity(11).label, "Guarding");
    });

    it('returns Sleeping for roll of 12', () => {
        assert.equal(resolveActivity(12).label, "Sleeping");
    });
});

describe('resolveReaction', () => {
    it('returns Hostile for roll of 2', () => {
        assert.equal(resolveReaction(2).label, "Hostile");
    });

    it('returns Hostile for roll of 6', () => {
        assert.equal(resolveReaction(6).label, "Hostile");
    });

    it('returns Suspicious for roll of 7', () => {
        assert.equal(resolveReaction(7).label, "Suspicious");
    });

    it('returns Suspicious for roll of 8', () => {
        assert.equal(resolveReaction(8).label, "Suspicious");
    });

    it('returns Neutral for roll of 9', () => {
        assert.equal(resolveReaction(9).label, "Neutral");
    });

    it('returns Curious for roll of 10', () => {
        assert.equal(resolveReaction(10).label, "Curious");
    });

    it('returns Curious for roll of 11', () => {
        assert.equal(resolveReaction(11).label, "Curious");
    });

    it('returns Friendly for roll of 12', () => {
        assert.equal(resolveReaction(12).label, "Friendly");
    });

    it('extends below 2 for negative CHA modifiers', () => {
        assert.equal(resolveReaction(0).label, "Hostile");
    });

    it('extends above 12 for positive CHA modifiers', () => {
        assert.equal(resolveReaction(14).label, "Friendly");
    });
});
