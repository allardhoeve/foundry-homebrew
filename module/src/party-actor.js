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
