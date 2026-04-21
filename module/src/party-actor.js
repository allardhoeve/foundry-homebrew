// Party Actor
//
// A GM dashboard for tracking party status during hex crawls and dungeon
// crawls. The Party actor aggregates read-only data from its member Player
// actors and can be placed as a single token on a scene.

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
        context.isEmpty = context.members.length === 0;
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Click member name -> open their character sheet
        html.find(".pa-member-name").on("click", async (e) => {
            e.preventDefault();
            const uuid = e.currentTarget.dataset.uuid;
            const actor = await fromUuid(uuid);
            actor?.sheet?.render(true);
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
        if (this.actor.system.members.includes(actor.uuid)) return;
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
            const hpFraction = hpMax > 0 ? hp / hpMax : 0;

            const rations = actor.items
                .filter(i => i.name.toLowerCase() === "rations" && !i.system.stashed)
                .reduce((sum, i) => sum + (i.system.quantity ?? 0), 0);

            const lightSources = actor.items
                .filter(i => i.system.light?.isSource && !i.system.stashed)
                .reduce((sum, i) => sum + (i.system.quantity ?? 0), 0);

            const activeLights = await actor.getActiveLightSources();
            const hasLight = activeLights?.length > 0;

            // Slot usage
            const slotUsage = actor.system.getSlotUsage();
            const slotsUsed = slotUsage.total;
            const slotsMax = actor.system.slots;
            const slotsOver = slotsUsed > slotsMax;

            const effects = [...actor.allApplicableEffects()]
                .filter(e => !e.isSuppressed && e.statuses.size > 0)
                .map(e => ({ name: e.name, icon: e.icon ?? e.img ?? "" }));

            const hpClass = hpFraction <= 0 ? "pa-hp--dead"
                : hpFraction < 0.5 ? "pa-hp--damaged"
                : "";

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

        const isMember = (actorId) => {
            for (const uuid of this.actor.system.members) {
                if (uuid === `Actor.${actorId}`) return true;
            }
            return false;
        };

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

// --- Party token light sync ---------------------------------------------------

let _lightSourceMappings = null;

async function getLightSourceMappings() {
    if (!_lightSourceMappings) {
        _lightSourceMappings = await foundry.utils.fetchJsonWithTimeout(
            "systems/shadowdark/assets/mappings/map-light-sources.json"
        );
    }
    return _lightSourceMappings;
}

const PA_NO_LIGHT = {
    bright: 0, dim: 0, angle: 360, alpha: 0.5,
    animation: { speed: 0, intensity: 0, type: null },
    color: null, coloration: 1, luminosity: 0.5,
    attenuation: 0.5, contrast: 0, saturation: 0, shadows: 0,
    darkness: { min: 0, max: 1 },
};

async function syncPartyLight(partyActor) {
    const mappings = await getLightSourceMappings();

    // Take the max bright and max dim independently across all member light sources
    let maxBright = 0;
    let maxDim = 0;
    let bestLight = null;

    for (const uuid of partyActor.system.members) {
        const actor = await fromUuid(uuid);
        if (!actor) continue;
        const activeLights = await actor.getActiveLightSources();
        for (const item of activeLights ?? []) {
            const template = item.system.light?.template;
            const mapping = template ? mappings[template] : null;
            if (!mapping) continue;
            const light = mapping.light;
            if ((light.bright || 0) > maxBright) maxBright = light.bright;
            if ((light.dim || 0) > maxDim) maxDim = light.dim;
            // Use the light with the largest reach as base for animation/color
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
    const sightRange = Math.max(maxBright, maxDim);

    const sightData = {
        enabled: hasLight,
        range: sightRange,
    };

    // Update all placed tokens for this party actor
    for (const scene of game.scenes) {
        const tokens = scene.tokens.filter(t => t.actorId === partyActor._id);
        for (const token of tokens) {
            await token.update({ light: lightData, sight: sightData });
        }
    }

    // Update prototype token
    await Actor.updateDocuments([{
        _id: partyActor._id,
        "prototypeToken.light": lightData,
        "prototypeToken.sight": sightData,
    }]);
}

const syncAllPartyLights = foundry.utils.debounce(async () => {
    const typeKey = `${PA_MODULE_ID}.Party`;
    for (const actor of game.actors) {
        if (actor.type === typeKey) await syncPartyLight(actor);
    }
}, PA_DEBOUNCE_MS);

function isPartyMember(actorId) {
    const typeKey = `${PA_MODULE_ID}.Party`;
    for (const actor of game.actors) {
        if (actor.type !== typeKey) continue;
        for (const uuid of actor.system.members) {
            if (uuid === `Actor.${actorId}`) return true;
        }
    }
    return false;
}

// --- Registration -------------------------------------------------------------

Hooks.once("init", () => {
    const typeKey = `${PA_MODULE_ID}.Party`;

    CONFIG.Actor.dataModels[typeKey] = PartyDataModel;
    CONFIG.Actor.typeLabels[typeKey] = "Party";

    foundry.documents.collections.Actors.registerSheet(PA_MODULE_ID, PartySheet, {
        types: [typeKey],
        makeDefault: true,
        label: "Party Sheet",
    });
});

// Light sync hooks — run even when the sheet is closed
Hooks.on("ready", () => {
    // Sync on member item changes (light sources lit/extinguished)
    const onMemberItem = (doc) => {
        if (isPartyMember(doc.parent?._id)) syncAllPartyLights();
    };
    Hooks.on("updateItem", onMemberItem);
    Hooks.on("createItem", onMemberItem);
    Hooks.on("deleteItem", onMemberItem);

    // Sync on world time changes (light timers expire)
    Hooks.on("updateWorldTime", syncAllPartyLights);

    // Sync when the party actor itself is updated (members added/removed)
    Hooks.on("updateActor", (actor) => {
        if (actor.type === `${PA_MODULE_ID}.Party`) syncAllPartyLights();
    });
});
