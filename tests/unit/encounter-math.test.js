import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, resolveEncounter } from '../../module/src/encounter-math.js';

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
});