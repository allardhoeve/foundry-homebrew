// Light Source Time Adjuster
//
// GM-only tool to manually adjust the remaining burn time of all active
// light sources across Player and NPC actors. Useful for fast-forwarding
// or rewinding light timers (e.g., "the party rested for 10 minutes").

const LA_MODULE_ID = "foundry-homebrew";

// --- Application ---------------------------------------------------------------

class LightAdjusterApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "light-adjuster",
        window: {
            title:       "Light Adjuster",
            resizable:   false,
            minimizable: true
        },
        position: { width: 320 }
    }, { inplace: false });

    _statusMessage = "";
    _hookIds = [];

    toggleInterface() {
        if (!game.user.isGM) return;
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
        }
    }

    async _renderHTML(_context, _options) {
        const container = document.createElement("div");
        container.className = "la-window";
        container.innerHTML = `
            <div class="la-title">Adjust Light Timers</div>
            <div class="la-button-grid">
                <button type="button" class="la-btn-primary" data-delta="-600">−10 min</button>
                <button type="button" class="la-btn-primary" data-delta="-60">−1 min</button>
                <button type="button" class="la-btn-primary" data-delta="60">+1 min</button>
                <button type="button" class="la-btn-primary" data-delta="600">+10 min</button>
            </div>
            <button type="button" class="la-btn-douse" data-action="douse-all">Expire All Lights</button>
            <div class="la-status">${this._statusMessage}</div>
            <div class="la-timers">${this._getTimerSummary()}</div>
        `;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (!root?.querySelectorAll) return;

        root.querySelectorAll("button[data-delta]").forEach(button => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                await this._adjustLights(Number(button.dataset.delta));
            });
        });

        root.querySelector("[data-action='douse-all']")?.addEventListener("click", async (event) => {
            event.preventDefault();
            await this._douseAll();
        });

        this._registerHooks();
    }

    _onClose(options) {
        this._unregisterHooks();
        return super._onClose(options);
    }

    _refreshTimers() {
        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        const el = root?.querySelector(".la-timers");
        if (el) el.innerHTML = this._getTimerSummary();
    }

    _registerHooks() {
        this._unregisterHooks();

        const refresh = () => {
            if (!this.rendered) return;
            this._refreshTimers();
        };

        const register = (name, fn) => {
            const id = Hooks.on(name, fn);
            this._hookIds.push({ name, id });
        };

        register("updateItem", refresh);
        register("createItem", refresh);
        register("deleteItem", refresh);
        register("updateWorldTime", refresh);
    }

    _unregisterHooks() {
        for (const { name, id } of this._hookIds) {
            Hooks.off(name, id);
        }
        this._hookIds = [];
    }

    _getTimerSummary() {
        const entries = game.actors
            .filter(a => a.type === "Player" || a.type === "NPC")
            .flatMap(a => a.items
                .filter(i => i.system.light?.isSource && i.system.light?.active)
                .map(i => {
                    const secs = i.system.light.remainingSecs ?? 0;
                    const m = Math.floor(secs / 60);
                    const s = String(secs % 60).padStart(2, "0");
                    return `${a.name}&nbsp;${m}m${s}`;
                })
            );
        return entries.join(" - ");
    }

    // The Shadowdark light source tracker caches item snapshots via toObject().
    // After we modify remainingSecs directly, the cached snapshot is stale and
    // the next tick would overwrite our change. Marking it dirty forces a
    // re-gather from the live item data before the next tick runs.
    _invalidateSystemTracker() {
        const tracker = game.shadowdark?.lightSourceTracker;
        if (tracker) tracker.dirty = true;
    }

    async _douseAll() {
        if (!game.user.isGM) return;

        const actors = game.actors.filter(a => a.type === "Player" || a.type === "NPC");
        let totalLights = 0;

        for (const actor of actors) {
            const lightItems = actor.items.filter(item =>
                item.system.light?.isSource && item.system.light?.active
            );
            for (const item of lightItems) {
                await item.update({ "system.light.remainingSecs": 0 });
                totalLights++;
            }
        }

        this._statusMessage = totalLights > 0
            ? `Doused ${totalLights} light${totalLights !== 1 ? "s" : ""}`
            : "No active lights found";
        this._invalidateSystemTracker();
        this.render({ force: true });
    }

    async _adjustLights(deltaSeconds) {
        if (!game.user.isGM) return;

        const actors = game.actors.filter(a => a.type === "Player" || a.type === "NPC");
        let totalLights = 0;
        let totalActors = 0;

        for (const actor of actors) {
            const lightItems = actor.items.filter(item =>
                item.system.light?.isSource && item.system.light?.active
            );
            if (lightItems.length === 0) continue;

            totalActors++;
            for (const item of lightItems) {
                const current = item.system.light.remainingSecs ?? 0;
                const maxSecs = (item.system.light.longevityMins ?? 0) * 60;
                const newSecs = Math.max(0, Math.min(current + deltaSeconds, maxSecs));
                await item.update({ "system.light.remainingSecs": newSecs });
                totalLights++;
            }
        }

        // Format the delta for display
        const absMins = Math.abs(deltaSeconds) / 60;
        const sign = deltaSeconds >= 0 ? "+" : "−";
        const label = absMins >= 1 ? `${sign}${absMins}m` : `${sign}${Math.abs(deltaSeconds)}s`;

        if (totalLights > 0) {
            this._statusMessage = `Adjusted ${totalLights} light${totalLights !== 1 ? "s" : ""} on ${totalActors} actor${totalActors !== 1 ? "s" : ""} by ${label}`;
        } else {
            this._statusMessage = "No active lights found";
        }

        this._invalidateSystemTracker();
        this.render({ force: true });
    }
}

// --- Registration --------------------------------------------------------------

Hooks.once("init", () => {
    const module = game.modules.get(LA_MODULE_ID);
    module.api ??= {};
    module.api.lightAdjuster = new LightAdjusterApp();
});
