// Party Actor
//
// A GM dashboard for tracking party status during hex crawls and dungeon
// crawls. The Party actor aggregates read-only data from its member Player
// actors and can be placed as a single token on a scene.

import { computeHpClass } from "./party-hp.js";
import { countRations, countLightSources, computeSlotStatus, collectEffects, isMemberOf } from "./party-members.js";
import { computePartyOwnership } from "./party-ownership.js";
import { mergePartyTokens, explodePartyTokens } from "./party-tokens.js";

const PA_MODULE_ID = "foundry-homebrew";
const PA_MODULE_PATH = "modules/foundry-homebrew";
const PA_DEBOUNCE_MS = 250;

// --- Data Model ---------------------------------------------------------------

class PartyDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            members: new fields.ArrayField(
                new fields.DocumentUUIDField({ type: "Actor" })
            ),
            notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
            merged: new fields.BooleanField({ initial: false }),
        };
    }
}

// --- Sheet --------------------------------------------------------------------

class PartySheet extends foundry.appv1.sheets.ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["shadowdark", "sheet", "party-sheet"],
            width: 480,
            height: 600,
            resizable: true,
        });
    }

    get template() {
        return `${PA_MODULE_PATH}/templates/party-sheet.hbs`;
    }

    _hookIds = [];

    async getData(options) {
        const context = await super.getData(options);
        context.actor = this.actor;
        context.members = await this._getMemberData();
        context.notes = this.actor.system.notes;
        context.merged = this.actor.system.merged;
        context.isEmpty = context.members.length === 0;
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        /* Add listeners for buttons on the Party sheet */

        // Click member name -> open their character sheet
        html.find(".pa-member-name").on("click", async (e) => {
            e.preventDefault();
            const uuid = e.currentTarget.dataset.uuid;
            const actor = await fromUuid(uuid);
            actor?.sheet?.render(true);
        });

        // Merge button -> collapse member tokens into party token
        html.find(".pa-merge-btn").on("click", async (e) => {
            e.preventDefault();
            await mergePartyTokens(this.actor);
        });

        // Explode button -> expand party token into member tokens
        html.find(".pa-explode-btn").on("click", async (e) => {
            e.preventDefault();
            await explodePartyTokens(this.actor);
        });

        // Click X -> remove member
        html.find(".pa-remove").on("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const uuid = e.currentTarget.dataset.uuid;
            const members = this.actor.system.members.filter(m => m !== uuid);
            await this.actor.update({ "system.members": members });
        });

        // Register reactivity hooks on first render
        if (this._hookIds.length === 0) {
            this._registerHooks();
        }
    }

    // --- Drag and drop ---

    async _onDropActor(_event, data) {
        const actor = await Actor.implementation.fromDropData(data);
        if (!actor) return;
        if (actor.type !== "Player") {
            ui.notifications.warn("Only Player characters can be added to the party.");
            return;
        }
        if (isMemberOf(this.actor.system.members, actor._id)) return;
        await this.actor.update({
            "system.members": [...this.actor.system.members, actor.uuid],
        });
    }

    // --- Member data aggregation ---

    async _getMemberData() {
        const members = [];
        for (const uuid of this.actor.system.members) {
            const actor = await fromUuid(uuid);
            if (!actor) continue;

            const hp = actor.system.attributes.hp.value;
            const hpMax = actor.system.attributes.hp.max;
            const rations = countRations(actor.items);
            const lightSources = countLightSources(actor.items);
            const hasLight = (await actor.getActiveLightSources())?.length > 0;
            const { used: slotsUsed, max: slotsMax, over: slotsOver } = computeSlotStatus(actor.system);
            const { statuses, effects } = collectEffects(actor);
            const hpClass = computeHpClass(hp, hpMax, statuses);

            members.push({
                uuid, name: actor.name, img: actor.img,
                hp, hpMax, hpClass, rations, lightSources, hasLight,
                slotsUsed, slotsMax, slotsOver, effects,
            });
        }
        return members;
    }

    // --- Reactivity ---

    _registerHooks() {
        const refresh = foundry.utils.debounce(() => {
            if (!this.rendered) return;
            this.render({ force: false });
        }, PA_DEBOUNCE_MS);

        const isMember = (actorId) => isMemberOf(this.actor.system.members, actorId);
        const isMemberChild = (doc) => isMember(doc.parent?._id);

        const register = (name, fn) => {
            const id = Hooks.on(name, fn);
            this._hookIds.push({ name, id });
        };

        register("updateActor", (actor) => {
            if (isMember(actor._id)) refresh();
        });
        register("updateItem", (item) => { if (isMemberChild(item)) refresh(); });
        register("createItem", (item) => { if (isMemberChild(item)) refresh(); });
        register("deleteItem", (item) => { if (isMemberChild(item)) refresh(); });
        register("createActiveEffect", (effect) => { if (isMemberChild(effect)) refresh(); });
        register("deleteActiveEffect", (effect) => { if (isMemberChild(effect)) refresh(); });
        register("updateActiveEffect", (effect) => { if (isMemberChild(effect)) refresh(); });
    }

    _unregisterHooks() {
        for (const { name, id } of this._hookIds) {
            Hooks.off(name, id);
        }
        this._hookIds = [];
    }

    async close(options) {
        this._unregisterHooks();
        return super.close(options);
    }
}

// --- Party state sync ---------------------------------------------------------
// One function syncs everything: light, sight, ownership.
// Resolves member actors once, computes all derived state, applies in one pass.

const _lightSourceMappings = foundry.utils.fetchJsonWithTimeout(
    "systems/shadowdark/assets/mappings/map-light-sources.json"
);

const PA_NO_LIGHT = {
    bright: 0, dim: 0, angle: 360, alpha: 0.5,
    animation: { speed: 0, intensity: 0, type: null },
    color: null, coloration: 1, luminosity: 0.5,
    attenuation: 0.5, contrast: 0, saturation: 0, shadows: 0,
    darkness: { min: 0, max: 1 },
};

async function syncPartyState(partyActor) {
    const mappings = await _lightSourceMappings;

    // Resolve all member actors once
    const memberActors = [];
    for (const uuid of partyActor.system.members) {
        const actor = await fromUuid(uuid);
        if (actor) memberActors.push(actor);
    }

    // --- Light & sight ---
    let maxBright = 0;
    let maxDim = 0;
    let bestLight = null;

    for (const actor of memberActors) {
        const activeLights = await actor.getActiveLightSources();
        for (const item of activeLights ?? []) {
            const template = item.system.light?.template;
            const mapping = template ? mappings[template] : null;
            if (!mapping) continue;
            const light = mapping.light;
            if ((light.bright || 0) > maxBright) maxBright = light.bright;
            if ((light.dim || 0) > maxDim) maxDim = light.dim;
            const reach = Math.max(light.bright || 0, light.dim || 0);
            if (!bestLight || reach > Math.max(bestLight.bright || 0, bestLight.dim || 0)) {
                bestLight = light;
            }
        }
    }

    const hasLight = maxBright > 0 || maxDim > 0;
    const lightData = hasLight
        ? { ...bestLight, bright: maxBright, dim: maxDim }
        : PA_NO_LIGHT;
    const sightData = {
        enabled: hasLight,
        range: Math.max(maxBright, maxDim),
    };

    // --- Ownership ---
    const ownership = computePartyOwnership(
        memberActors.map(a => a.ownership),
        Array.from(game.users),
    );

    // --- Apply ---
    for (const scene of game.scenes) {
        const tokens = scene.tokens.filter(t => t.actorId === partyActor._id);
        for (const token of tokens) {
            await token.update({ light: lightData, sight: sightData });
        }
    }

    await partyActor.update({
        ownership,
        "prototypeToken.light": lightData,
        "prototypeToken.sight": sightData,
    });
}

const syncAllPartyState = foundry.utils.debounce(async () => {
    const typeKey = `${PA_MODULE_ID}.Party`;
    for (const actor of game.actors) {
        if (actor.type === typeKey) await syncPartyState(actor);
    }
}, PA_DEBOUNCE_MS);

function isPartyMember(actorId) {
    const typeKey = `${PA_MODULE_ID}.Party`;
    for (const actor of game.actors) {
        if (actor.type !== typeKey) continue;
        if (isMemberOf(actor.system.members, actorId)) return true;
    }
    return false;
}

// --- Registration -------------------------------------------------------------

Hooks.once("init", () => {
    const typeKey = `${PA_MODULE_ID}.Party`;

    CONFIG.Actor.dataModels[typeKey] = PartyDataModel;
    CONFIG.Actor.typeLabels[typeKey] = "HOMEBREW.actor.party";

    foundry.documents.collections.Actors.registerSheet(PA_MODULE_ID, PartySheet, {
        types: [typeKey],
        makeDefault: true,
        label: "Party Sheet",
    });
});

// State sync hooks — run even when the sheet is closed
Hooks.on("ready", () => {
    const onMemberItem = (doc) => {
        if (isPartyMember(doc.parent?._id)) syncAllPartyState();
    };
    Hooks.on("updateItem", onMemberItem);
    Hooks.on("createItem", onMemberItem);
    Hooks.on("deleteItem", onMemberItem);
    Hooks.on("updateWorldTime", syncAllPartyState);
    Hooks.on("updateActor", (actor) => {
        if (actor.type === `${PA_MODULE_ID}.Party`) syncAllPartyState();
    });
});
