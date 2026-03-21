# Task 017: Reorganize project root — move module files into `module/`

Independent of other tasks.

## Goal

Move all Foundry module files into a `module/` subdirectory to separate the module (what Foundry loads) from development scaffolding (tests, docker, docs, CI). Also delete temp artifacts cluttering the root.

## Background

The project root mixes module files with dev tooling, making it hard to navigate when returning after time away. The module files need to stay in a flat structure relative to each other (Foundry requirement), but that structure can live inside `module/`.

## Context

- `module.json` — Foundry manifest; internal paths (`src/...`, `styles/...`, `packs/macros`) are relative to the module root and stay unchanged
- `build.mjs` — reads `macros/macros.json`, writes compiled packs to `packs/macros/`
- `macros/macros.json` — `file` fields use root-relative paths like `macros/random-encounter-check.js`
- `deploy` — rsyncs module files to remote, stamps version in `module.json`
- `docker/docker-compose.yml` — mounts `../` (project root) as the Foundry module at `/data/Data/modules/foundry-homebrew:ro`
- `.github/workflows/release.yml` — zips module files for GitHub release, stamps version in `module.json`
- `.gitignore` — references `packs/` which will move
- `docs/TESTING.md` — references Docker bind-mount path and `packs/macros/` build output (3 locations)
- `README.md` — "Repository structure" section documents current flat layout
- `.claude/settings.local.json` — hardcoded permission paths reference `src/`, `macros/`, `packs/`

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| What to name the directory? | `module/` — self-documenting |
| Do `module.json` internal paths change? | No — they're relative to the module root, which is still what Docker/deploy targets |
| Do `macros.json` icon paths change? | No — `modules/foundry-homebrew/assets/...` are Foundry-relative URLs |
| Do `macros.json` file paths change? | Yes — they're relative to project root where `build.mjs` runs |

## Changes

### Step 1: Delete temp artifacts

Remove from disk (already gitignored):

- `login-start-world-join-return-to-setup.har` (30MB)
- `running-admin-login-logout.har` (19MB)
- `playwright-report/`
- `test-results/`
- `.playwright-mcp/`

### Step 2: Create `module/` and move Foundry files

```bash
mkdir module/
git mv module.json module/
git mv src/ module/
git mv styles/ module/
git mv macros/ module/
git mv assets/ module/
# packs/ is gitignored — just move it
mv packs/ module/
```

### Modified: `docker/docker-compose.yml`

Volume mount changes from project root to module directory:

```yaml
# Before
- ../:/data/Data/modules/foundry-homebrew:ro
# After
- ../module:/data/Data/modules/foundry-homebrew:ro
```

### Modified: `build.mjs`

Update paths (build runs from project root):

- `readFileSync("macros/macros.json")` → `readFileSync("module/macros/macros.json")`
- `resolve("packs/macros")` (outDir) → `resolve("module/packs/macros")`
- Temp dir `.build-tmp/packs/macros` stays unchanged

### Modified: `module/macros/macros.json`

Update `file` fields (4 entries):

- `"file": "macros/random-encounter-check.js"` → `"file": "module/macros/random-encounter-check.js"`
- `"file": "macros/scarlet-minotaur-encounter-check.js"` → `"file": "module/macros/scarlet-minotaur-encounter-check.js"`
- `"file": "macros/player-light-tracker-macro.js"` → `"file": "module/macros/player-light-tracker-macro.js"`
- `"file": "macros/light-adjuster-macro.js"` → `"file": "module/macros/light-adjuster-macro.js"`

### Modified: `deploy`

`cd` into module directory so rsync relative paths stay the same:

```bash
cd "$SCRIPT_DIR/module"

sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" module.json

rsync -aizR \
  module.json src/ styles/ macros/ assets/ \
  "$DEST"

cd "$SCRIPT_DIR"
git checkout -- module/module.json
```

### Modified: `.github/workflows/release.yml`

1. Version stamp sed target: `module.json` → `module/module.json`
2. Release zip — cd into module/ so zip internal paths match Foundry's expected layout:

```yaml
- name: Stamp version from git tag
  run: |
    TAG=${GITHUB_REF_NAME#v}
    npm version "$TAG" --no-git-tag-version
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$TAG\"/" module/module.json

- name: Create release zip
  run: |
    cd module
    zip -r ../module.zip \
      module.json packs/ macros/ src/ styles/ assets/
    cd ..
    zip module.zip LICENSE
```

### Modified: `.gitignore`

- `packs/` → `module/packs/`

### Modified: `docs/TESTING.md`

Update 3 path references:

1. Docker bind-mount explanation: `../:/data/Data/modules/foundry-homebrew:ro` → `../module:/data/Data/modules/foundry-homebrew:ro`
2. Build instruction: `packs/macros/` → `module/packs/macros/` (line ~149)
3. BDD setup note: `packs/macros/` → `module/packs/macros/` (line ~161)

### Modified: `README.md`

Update "Repository structure" section to show `module/` as the parent directory for `module.json`, `src/`, `styles/`, `macros/`, `assets/`, `packs/`.

### Modified: `.claude/settings.local.json`

Update hardcoded permission paths:

- `packs src/packs` → `module/packs module/src/packs`
- `find .../src .../macros` → `find .../module/src .../module/macros`
- `find .../packs` → `find .../module/packs`

## Verification

```bash
# Confirm git tracks the moves correctly
git status

# Build still works
npm run build

# Docker container loads the module
docker compose -f docker/docker-compose.yml up -d
# Check Foundry UI at http://localhost:30000 — module should appear and function

# BDD tests pass
npm test

# Deploy script dry-run
./deploy  # or inspect paths manually
```

## Acceptance criteria

- [ ] Temp artifacts deleted (`.har` files, `playwright-report/`, `test-results/`, `.playwright-mcp/`)
- [ ] `module/` contains: `module.json`, `src/`, `styles/`, `macros/`, `assets/`, `packs/`
- [ ] `npm run build` compiles packs to `module/packs/macros/`
- [ ] Docker container mounts and loads the module correctly
- [ ] `deploy` script rsyncs correct files
- [ ] GitHub release workflow would produce a correct `module.zip`
- [ ] `docs/TESTING.md` and `README.md` path references updated
- [ ] `.claude/settings.local.json` permission paths updated
- [ ] All existing tests still pass

## Scope boundaries

- **In scope**: File moves, path updates in build/deploy/CI/docker scripts, deleting temp artifacts, updating path references in docs and `.claude/settings.local.json`
- **Out of scope**: Changing module functionality, updating test content, restructuring docs/
- **Do not** modify `module.json` internal paths (they're relative to the module root)
