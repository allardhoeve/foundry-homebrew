// Player Light Tracker
// Shows the player's active light source with immersive, thematic feedback.
// No exact timers — just vague descriptions of how their light is doing.

const PLT_MODULE_PATH = "modules/foundry-homebrew";

// Playback rate for ignite/extinguish transition animations (1.0 = normal speed)
const PLT_TRANSITION_SPEED = 0.5;

// Light remaining-fraction thresholds for state changes
const PLT_BRIGHT_THRESHOLD = 0.5;   // above this → bright
const PLT_GOOD_THRESHOLD = 0.25;    // above this → good, below → fading

// How long to wait (ms) before re-rendering after a hook fires
const PLT_DEBOUNCE_MS = 250;

// Default window width in pixels
const PLT_WINDOW_WIDTH = 320;

const PLT_VIDEOS = {
    torch: {
        bright: "yellow.mp4",
        good: "orange.mp4",
        fading: "red.mp4",
        darkness: null,
        ignite: "ignite.mp4",
        extinguish: "extinguish.mp4",
    },
    spell: {
        bright: "staff.mp4",
        good: "staff.mp4",
        fading: "staff.mp4",
        darkness: null,
        ignite: "staffIgnite.mp4",
        extinguish: "staffExtinguish.mp4",
    },
};

const PLT_STYLES = `
    /* Override Foundry window chrome */
    #player-light-tracker {
        background: #000000;
        border: 1px solid #333;
        border-radius: 4px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    }

    #player-light-tracker .window-header {
        background: transparent;
        border: none;
        padding: 2px 4px;
        min-height: 0;
    }

    #player-light-tracker .window-title {
        display: none;
    }

    .plt-window {
        background: #000000;
        color: #e8dcc8;
        text-align: center;
        padding: 24px 20px;
        min-width: 280px;
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }

    .plt-status-text {
        font-family: "JSL Blackletter", serif;
        font-size: 28px;
        line-height: 1.3;
        color: #e8dcc8;
        transition: color 0.8s ease, text-shadow 0.8s ease;
    }

    .plt-light-name {
        font-size: 13px;
        color: #888;
        font-style: italic;
    }

    .plt-animation {
        width: 100%;
        aspect-ratio: 750 / 1334;
        position: relative;
        overflow: hidden;
    }

    .plt-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        transition: opacity 0.8s ease;
    }

    .plt-video-hidden {
        opacity: 0;
    }

    /* State: darkness */
    .plt-state-darkness .plt-status-text {
        color: #888;
    }

    /* State: bright */
    .plt-state-bright .plt-status-text {
        color: #f5c542;
        text-shadow: 0 0 20px rgba(245, 197, 66, 0.4);
    }

    /* State: good */
    .plt-state-good .plt-status-text {
        color: #d4a843;
        text-shadow: 0 0 12px rgba(212, 168, 67, 0.25);
    }

    /* State: fading */
    .plt-state-fading .plt-status-text {
        color: #a07030;
        text-shadow: 0 0 6px rgba(160, 112, 48, 0.2);
        animation: plt-flicker 2s ease-in-out infinite;
    }

    @keyframes plt-flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .plt-debug-bar {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background: #000000;
        border-bottom: 1px solid #333;
        font-size: 11px;
        color: #888;
    }

    .plt-debug-bar label {
        white-space: nowrap;
    }

    .plt-debug-bar select {
        flex: 1;
        background: #111;
        color: #ccc;
        border: 1px solid #444;
        padding: 2px 4px;
        font-size: 11px;
    }

    .plt-douse-btn {
        background: transparent;
        border: 1px solid #555;
        color: #999;
        padding: 6px 16px;
        cursor: pointer;
        font-size: 12px;
        transition: border-color 0.3s, color 0.3s;
    }

    .plt-douse-btn:hover {
        border-color: #a07030;
        color: #e8dcc8;
    }

    .plt-douse-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const STATES = {
    DARKNESS: "darkness",
    BRIGHT: "bright",
    GOOD: "good",
    FADING: "fading",
};

const DARKNESS_DATA = {
    stateKey: STATES.DARKNESS,
    statusText: "The darkness engulfs you",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

function getLightState(item) {
    const remaining = item.system.light.remainingSecs;
    const total = item.system.light.longevityMins * 60;
    if (total <= 0) return { key: STATES.BRIGHT, text: "Your light shines brightly" };
    const fraction = remaining / total;
    if (fraction > PLT_BRIGHT_THRESHOLD) return { key: STATES.BRIGHT, text: "Your light shines brightly" };
    if (fraction > PLT_GOOD_THRESHOLD) return { key: STATES.GOOD, text: "Your light shines well" };
    return { key: STATES.FADING, text: "Your light starts to fade" };
}

function getLightType(item) {
    if (!item) return "torch";
    const type = item.type?.toLowerCase();
    if (type === "spell" || type === "effect") return "spell";
    return "torch";
}

function getVideoPath(filename) {
    return `${PLT_MODULE_PATH}/assets/video/${filename}`;
}

class PlayerLightTrackerApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "player-light-tracker",
        window: {
            title: "Light",
            resizable: false,
            minimizable: false,
        },
        position: {
            width: PLT_WINDOW_WIDTH,
        },
    });

    constructor(options = {}) {
        super(options);
        this._hookIds = [];
        this._viewedActorId = null;
    }

    get actor() {
        // GM override: use the explicitly selected actor from the debug dropdown
        if (this._viewedActorId) {
            const viewed = game.actors.get(this._viewedActorId);
            if (viewed) return viewed;
        }
        // Prefer the explicitly assigned character, fall back to first owned PC
        return game.user.character
            ?? game.actors.find(a => a.isOwner && a.type === "Player");
    }

    get _rootElement() {
        return this.element instanceof HTMLElement ? this.element : this.element?.[0];
    }

    async _renderHTML(_context, _options) {
        const container = document.createElement("div");

        // Inject styles once
        if (!document.getElementById("plt-styles")) {
            const style = document.createElement("style");
            style.id = "plt-styles";
            style.textContent = PLT_STYLES;
            document.head.appendChild(style);
        }

        const { stateKey, statusText, lightName, lightItem, lightType } = await this._getLightData();
        const videos = PLT_VIDEOS[lightType];
        const videoFile = videos[stateKey];

        // Build GM debug bar
        let debugBarHTML = "";
        if (game.user.isGM) {
            const playerActors = game.actors.filter(a => a.type === "Player");
            const currentId = this.actor?._id ?? "";
            const options = playerActors.map(a =>
                `<option value="${a._id}" ${a._id === currentId ? "selected" : ""}>${a.name}</option>`
            ).join("");
            debugBarHTML = `
                <div class="plt-debug-bar">
                    <label>Viewing:</label>
                    <select class="plt-debug-select">${options}</select>
                </div>`;
        }

        container.innerHTML = `
            <div class="plt-window plt-state-${stateKey}" data-state="${stateKey}" data-light-type="${lightType}">
                ${debugBarHTML}
                <div class="plt-animation">
                    ${videoFile ? `<video class="plt-video" autoplay loop muted playsinline
                           src="${getVideoPath(videoFile)}"></video>` : ""}
                </div>
                <div class="plt-status-text">${statusText}</div>
                ${lightName ? `<div class="plt-light-name">${lightName}</div>` : ""}
                ${lightItem ? `<button type="button" class="plt-douse-btn">Douse my flame</button>` : ""}
            </div>
        `;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        // Wire douse button
        const root = this._rootElement;
        if (!root?.querySelector) return;

        // Wire debug dropdown (GM only)
        const debugSelect = root.querySelector(".plt-debug-select");
        if (debugSelect) {
            debugSelect.addEventListener("change", (event) => {
                this._viewedActorId = event.target.value;
                this._prevStateKey = null;
                this._lastStateKey = null;
                this._unregisterHooks();
                this._hookIds = [];
                this.render({ force: true });
            });
        }

        const douseBtn = root.querySelector(".plt-douse-btn");
        if (douseBtn) {
            douseBtn.addEventListener("click", async (event) => {
                event.preventDefault();
                await this._onDouse();
            });
        }

        // Handle video transitions
        this._handleVideoTransition(root);

        // Register hooks (only on first render)
        if (this._hookIds.length === 0) {
            this._registerHooks();
        }
    }

    _handleVideoTransition(root) {
        const pltWindow = root.querySelector(".plt-window");
        if (!pltWindow) return;

        const currentState = pltWindow.dataset.state;
        const lightType = pltWindow.dataset.lightType;
        const prevState = this._prevStateKey;
        const video = root.querySelector(".plt-video");

        if (!video) return;

        // First render or no state change — just play the loop
        if (!prevState) {
            this._prevStateKey = currentState;
            return;
        }

        const videos = PLT_VIDEOS[lightType];
        const isLit = (s) => s !== STATES.DARKNESS;

        // Transition: lit → darkness (play extinguish, then go black)
        if (isLit(prevState) && !isLit(currentState)) {
            // Need to create a video element since darkness renders none
            if (!video) {
                const animation = root.querySelector(".plt-animation");
                const v = document.createElement("video");
                v.className = "plt-video";
                v.autoplay = true;
                v.muted = true;
                v.playsInline = true;
                animation.appendChild(v);
                this._playTransitionThenRemove(v, videos.extinguish);
            } else {
                this._playTransitionThenRemove(video, videos.extinguish);
            }
        }
        // Transition: darkness → lit (play ignite first)
        else if (!isLit(prevState) && isLit(currentState)) {
            this._playTransitionThenLoop(video, videos.ignite, videos[currentState]);
        }
        // Otherwise the new loop video is already set by _renderHTML

        this._prevStateKey = currentState;
    }

    _playTransitionThenLoop(video, transitionFile, loopFile) {
        video.loop = false;
        video.playbackRate = PLT_TRANSITION_SPEED;
        video.src = getVideoPath(transitionFile);
        video.play().catch(() => {});

        video.addEventListener("ended", () => {
            video.src = getVideoPath(loopFile);
            video.loop = true;
            video.playbackRate = 1.0;
            video.play().catch(() => {});
        }, { once: true });
    }

    _playTransitionThenRemove(video, transitionFile) {
        video.loop = false;
        video.playbackRate = PLT_TRANSITION_SPEED;
        video.src = getVideoPath(transitionFile);
        video.play().catch(() => {});

        video.addEventListener("ended", () => {
            video.remove();
        }, { once: true });
    }

    async _onClose(options) {
        await super._onClose(options);
        this._unregisterHooks();
        document.getElementById("plt-styles")?.remove();
        this._lastStateKey = null;
        this._prevStateKey = null;
    }


    async _getLightData() {
        const actor = this.actor;
        if (!actor) return DARKNESS_DATA;

        const activeLights = await actor.getActiveLightSources();
        if (!activeLights || activeLights.length === 0) return DARKNESS_DATA;

        // Pick the light with the shortest remaining duration
        const sorted = [...activeLights].sort(
            (a, b) => a.system.light.remainingSecs - b.system.light.remainingSecs
        );
        const item = sorted[0];
        const state = getLightState(item);

        return {
            stateKey: state.key,
            statusText: state.text,
            lightName: item.name,
            lightItem: item,
            lightType: getLightType(item),
        };
    }

    async _onDouse() {
        const { lightItem } = await this._getLightData();
        if (!lightItem) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Douse Light" },
            content: `<p style="text-align: center; font-style: italic;">Extinguish your ${lightItem.name}?<br>The darkness waits...</p>`,
            yes: { label: "Douse my flame" },
            no: { label: "Not yet" },
        });

        if (!confirmed) return;

        // Re-check that the light still exists (it may have expired)
        const { lightItem: currentLight } = await this._getLightData();
        if (!currentLight) {
            ui.notifications.warn("Your light has already gone out.");
            return;
        }

        const actor = this.actor;
        await actor.yourLightWentOut(currentLight._id);
        if (currentLight.type === "Effect") {
            await actor.deleteEmbeddedDocuments("Item", [currentLight._id]);
        } else {
            await actor.updateEmbeddedDocuments("Item", [{
                "_id": currentLight._id,
                "system.light.active": false,
            }]);
        }
    }

    _registerHooks() {
        const refresh = foundry.utils.debounce(async () => {
            if (!this.rendered) return;
            const { stateKey } = await this._getLightData();
            if (stateKey === this._lastStateKey) return;
            this._lastStateKey = stateKey;
            this.render({ force: false });
        }, PLT_DEBOUNCE_MS);

        const actorId = this.actor?._id;
        if (!actorId) return;

        // Re-render when items on our actor change
        const register = (name, fn) => {
            const id = Hooks.on(name, fn);
            this._hookIds.push({ name, id });
        };

        register("updateItem", (item) => {
            if (item.parent?._id === actorId) refresh();
        });
        register("createItem", (item) => {
            if (item.parent?._id === actorId) refresh();
        });
        register("deleteItem", (item) => {
            if (item.parent?._id === actorId) refresh();
        });

        // Also refresh on world time changes (light timers updated by GM)
        register("updateWorldTime", () => refresh());
    }

    _unregisterHooks() {
        for (const { name, id } of this._hookIds) {
            Hooks.off(name, id);
        }
        this._hookIds = [];
    }
}

// Singleton pattern — toggle on repeated macro execution
if (!game.playerLightTrackerApp) {
    game.playerLightTrackerApp = new PlayerLightTrackerApp();
}

if (game.playerLightTrackerApp.rendered) {
    game.playerLightTrackerApp.close();
} else {
    game.playerLightTrackerApp.render({ force: true });
}
