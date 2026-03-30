// Asset Browser
//
// A full-featured image browser for tokens and artwork. Discovers source
// folders from installed modules automatically and presents images in a
// large grid with folder navigation and search. Click to copy the path.

const AB_MODULE_ID = "foundry-homebrew";

const CATEGORY_CONFIG = {
    tokens: {
        title: "Token Browser",
        keywords: ["token", "tokens"],
        extensions: [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"]
    },
    artwork: {
        title: "Artwork Browser",
        keywords: ["artwork", "art", "portrait", "portraits", "image", "images"],
        extensions: [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"]
    }
};

// --- Application ---------------------------------------------------------------

class AssetBrowserApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "asset-browser",
        window: {
            title: "Asset Browser",
            resizable: true,
            minimizable: true
        },
        position: { width: 900, height: 700 }
    }, { inplace: false });

    _category = "tokens";
    _sources = null;
    _discoveryDone = false;
    _folderTree = [];
    _expandedFolders = new Set();
    _selectedFolder = null;
    _images = [];
    _searchTerm = "";
    _browseCache = new Map();

    // --- Public API ---

    open(category = "tokens") {
        this._category = category;
        this._sources = null;
        this._discoveryDone = false;
        this._folderTree = [];
        this._expandedFolders = new Set();
        this._selectedFolder = null;
        this._images = [];
        this._searchTerm = "";
        this._browseCache.clear();
        this.render({ force: true });
    }

    // --- Rendering ---

    async _renderHTML(_context, _options) {
        const config = CATEGORY_CONFIG[this._category];
        const container = document.createElement("div");
        container.className = "ab-window";
        container.innerHTML = `
            <div class="ab-title">${config.title}</div>
            <div class="ab-body">
                <div class="ab-sidebar">
                    <div class="ab-sidebar-header">Sources</div>
                    ${this._discoveryDone ? this._renderFolderTree() : '<div class="ab-loading">Scanning modules...</div>'}
                </div>
                <div class="ab-content">
                    <div class="ab-search-bar">
                        <input type="text" class="ab-search-input" placeholder="Filter by name..." value="${this._escapeAttr(this._searchTerm)}">
                    </div>
                    <div class="ab-grid">
                        ${this._renderGrid()}
                    </div>
                </div>
            </div>
            <div class="ab-status">${this._renderStatus()}</div>
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

        // Kick off discovery on first render
        if (!this._discoveryDone) {
            await this._discoverSources();
            this._discoveryDone = true;
            this.render({ force: true });
            return;
        }

        this._wireSearchInput(root);
        this._wireFolderTree(root);
        this._wireImageCards(root);
    }

    // --- Search ---

    _wireSearchInput(root) {
        const input = root.querySelector(".ab-search-input");
        if (!input) return;
        const debounced = foundry.utils.debounce(() => {
            this._searchTerm = input.value;
            this._applyFilter(root);
        }, 200);
        input.addEventListener("input", debounced);
    }

    _applyFilter(root) {
        // Re-acquire root in case DOM was replaced by a re-render
        const el = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        const target = el || root;
        const term = this._searchTerm.toLowerCase();
        target.querySelectorAll(".ab-card").forEach(card => {
            const name = card.dataset.name || "";
            card.classList.toggle("ab-card--hidden", term !== "" && !name.includes(term));
        });
        this._updateStatus(target);
    }

    // --- Folder tree ---

    _wireFolderTree(root) {
        root.querySelectorAll(".ab-folder-label").forEach(label => {
            label.addEventListener("click", async () => {
                const path = label.dataset.path;
                const hasChildren = label.dataset.hasChildren === "true";

                // Toggle expand/collapse
                if (hasChildren) {
                    if (this._expandedFolders.has(path)) {
                        this._expandedFolders.delete(path);
                    } else {
                        this._expandedFolders.add(path);
                        await this._ensureChildrenLoaded(path);
                    }
                }

                // Select folder and load images
                this._selectedFolder = path;
                await this._loadImages(path);
                this.render({ force: true });
            });
        });
    }

    _renderFolderTree() {
        if (!this._sources || this._sources.length === 0) {
            return '<div class="ab-empty">No sources found</div>';
        }

        // Group sources by module to avoid duplicate module labels
        const byModule = new Map();
        for (const source of this._sources) {
            if (!byModule.has(source.moduleId)) {
                byModule.set(source.moduleId, { title: source.moduleTitle, sources: [] });
            }
            byModule.get(source.moduleId).sources.push(source);
        }

        let html = "";
        for (const [, mod] of byModule) {
            html += `<div class="ab-source-label">${this._escapeHtml(mod.title)}</div>`;
            // If multiple sources share the same basename, show parent/basename
            const basenames = mod.sources.map(s => this._getBasename(s.path));
            const hasDupes = new Set(basenames).size < basenames.length;
            for (const source of mod.sources) {
                const label = hasDupes ? this._getParentAndBasename(source.path) : this._getBasename(source.path);
                html += this._renderFolderNode(source.path, label, source.children || []);
            }
        }
        return html;
    }

    _renderFolderNode(path, name, children) {
        const isSelected = this._selectedFolder === path;
        const isExpanded = this._expandedFolders.has(path);
        const hasChildren = children.length > 0;
        const selectedClass = isSelected ? " ab-folder-label--selected" : "";
        const chevronClass = isExpanded ? " ab-folder-chevron--expanded" : "";
        const childrenClass = isExpanded ? "" : " ab-folder-children--hidden";

        let html = `<div class="ab-folder">`;
        html += `<div class="ab-folder-label${selectedClass}" data-path="${this._escapeAttr(path)}" data-has-children="${hasChildren}">`;
        html += `<i class="fas fa-chevron-right ab-folder-chevron${chevronClass}"></i>`;
        html += `<i class="fas fa-folder"></i>`;
        html += `<span>${this._escapeHtml(name)}</span>`;
        html += `</div>`;

        if (hasChildren) {
            html += `<div class="ab-folder-children${childrenClass}">`;
            for (const child of children) {
                html += this._renderFolderNode(child.path, child.name, child.children || []);
            }
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

    // --- Image grid ---

    _renderGrid() {
        if (!this._selectedFolder) {
            return '<div class="ab-empty">Select a folder to browse</div>';
        }
        if (this._images.length === 0) {
            return '<div class="ab-empty">No images in this folder</div>';
        }

        const term = this._searchTerm.toLowerCase();
        return this._images
            .filter(img => !term || img.name.toLowerCase().includes(term))
            .map(img => `
                <div class="ab-card" data-path="${this._escapeAttr(img.path)}" data-name="${this._escapeAttr(img.name.toLowerCase())}">
                    <div class="ab-card-thumb">
                        <img loading="lazy" src="${this._escapeAttr(img.path)}" alt="${this._escapeAttr(img.name)}">
                    </div>
                    <div class="ab-card-name" title="${this._escapeAttr(img.name)}">${this._escapeHtml(img.name)}</div>
                </div>
            `).join("");
    }

    _wireImageCards(root) {
        root.querySelectorAll(".ab-card").forEach(card => {
            card.addEventListener("click", async () => {
                const path = card.dataset.path;
                try {
                    await navigator.clipboard.writeText(path);
                } catch {
                    this._fallbackCopy(path);
                }
                card.classList.add("ab-card--copied");
                setTimeout(() => card.classList.remove("ab-card--copied"), 1200);
                ui.notifications.info(`Copied: ${path}`);
            });
        });
    }

    _fallbackCopy(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
    }

    // --- Status bar ---

    _renderStatus() {
        if (!this._selectedFolder) return "Select a folder to begin browsing";
        const total = this._images.length;
        const term = this._searchTerm.toLowerCase();
        const visible = term ? this._images.filter(i => i.name.toLowerCase().includes(term)).length : total;
        const countText = term ? `${visible} of ${total} images` : `${total} image${total !== 1 ? "s" : ""}`;
        return `${countText} &mdash; ${this._selectedFolder}`;
    }

    _updateStatus(root) {
        const el = root.querySelector(".ab-status");
        if (el) el.innerHTML = this._renderStatus();
    }

    // --- Discovery ---

    async _discoverSources() {
        const config = CATEGORY_CONFIG[this._category];
        const sources = [];

        // Scan active modules
        for (const mod of game.modules.values()) {
            if (!mod.active) continue;
            const basePath = `modules/${mod.id}`;
            const found = [];
            await this._scanForMatches(basePath, config.keywords, found, 0, 3);
            for (const dir of found) {
                const children = await this._loadSubfolders(dir);
                sources.push({
                    moduleId: mod.id,
                    moduleTitle: mod.title || mod.id,
                    path: dir,
                    children
                });
            }
        }

        // Scan the active game system
        if (game.system) {
            const sysPath = `systems/${game.system.id}`;
            const found = [];
            await this._scanForMatches(sysPath, config.keywords, found, 0, 3);
            for (const dir of found) {
                const children = await this._loadSubfolders(dir);
                sources.push({
                    moduleId: `system-${game.system.id}`,
                    moduleTitle: game.system.title || game.system.id,
                    path: dir,
                    children
                });
            }
        }

        this._sources = sources;
    }

    async _scanForMatches(path, keywords, found, depth, maxDepth) {
        if (depth >= maxDepth) return;
        try {
            const result = await this._browse(path);
            for (const dir of result.dirs) {
                const name = this._getBasename(dir).toLowerCase();
                if (keywords.some(kw => name.includes(kw))) {
                    found.push(dir);
                } else {
                    // Keep searching deeper in non-matching dirs
                    await this._scanForMatches(dir, keywords, found, depth + 1, maxDepth);
                }
            }
        } catch {
            // Not browsable — skip
        }
    }

    async _loadSubfolders(path) {
        try {
            const result = await this._browse(path);
            const children = [];
            for (const dir of result.dirs) {
                const subChildren = await this._loadSubfolders(dir);
                children.push({
                    name: this._getBasename(dir),
                    path: dir,
                    children: subChildren
                });
            }
            return children;
        } catch {
            return [];
        }
    }

    async _ensureChildrenLoaded(path) {
        // Find the source or folder node and reload children if empty
        const node = this._findNode(path);
        if (node && (!node.children || node.children.length === 0)) {
            node.children = await this._loadSubfolders(path);
        }
    }

    _findNode(path) {
        for (const source of this._sources || []) {
            if (source.path === path) return source;
            const found = this._findNodeIn(source.children, path);
            if (found) return found;
        }
        return null;
    }

    _findNodeIn(children, path) {
        for (const child of children || []) {
            if (child.path === path) return child;
            const found = this._findNodeIn(child.children, path);
            if (found) return found;
        }
        return null;
    }

    // --- Image loading ---

    async _loadImages(folderPath) {
        const config = CATEGORY_CONFIG[this._category];
        try {
            const result = await this._browse(folderPath);
            this._images = result.files
                .filter(f => config.extensions.some(ext => f.toLowerCase().endsWith(ext)))
                .map(f => ({ path: f, name: this._getBasename(f) }));
        } catch {
            this._images = [];
        }
    }

    // --- FilePicker.browse wrapper with caching ---

    async _browse(path) {
        if (this._browseCache.has(path)) return this._browseCache.get(path);
        const result = await foundry.applications.apps.FilePicker.browse("data", path);
        this._browseCache.set(path, result);
        return result;
    }

    // --- Utilities ---

    _getBasename(path) {
        return path.split("/").filter(Boolean).pop() || path;
    }

    _getParentAndBasename(path) {
        const parts = path.split("/").filter(Boolean);
        return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : parts.pop() || path;
    }

    _escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    _escapeAttr(str) {
        return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

// --- Registration --------------------------------------------------------------

Hooks.once("init", () => {
    const module = game.modules.get(AB_MODULE_ID);
    module.api ??= {};
    module.api.assetBrowser = new AssetBrowserApp();
});
