# boogers

Mirrors the token gallery at <https://youseethis.blog/tokens/> into Foundry's
Data directory, and pushes it to production.

```
cd tools/boogers
uv run python download_tokens.py            # download anything new
uv run python download_tokens.py --dry-run  # list what is missing, write nothing
uv run python download_tokens.py --force    # re-download everything
./sync_tokens.sh                            # push them to production
./sync_tokens.sh --dry-run                  # list what would be pushed
```

Tokens land in `docker/data/Data/assets/tokens/youseethis/`, the dev instance's
Foundry Data directory, and `sync_tokens.sh` mirrors them into the same place on
production. Both ends therefore serve them at the same path:

```
assets/tokens/youseethis/<name>.png
```

so a token picked in the dev world resolves in production too.

They deliberately live in the Data directory rather than in the module tree.
Installing a new version of the module replaces the module folder wholesale, and
since the art is not in `module.zip` it would simply vanish. Nothing installs or
updates the Data directory, so there it survives.

The run is idempotent: a token already on disk is skipped, so re-running after
the artist adds to the page fetches only the new ones. Each download is written
to a `.part` file and renamed on success, so an interrupted run cannot leave a
truncated PNG behind that a later run would treat as complete.

Alongside the images it writes `CREDITS.md` (artist and terms) and
`manifest.json` (per-token source URL and the caption from the page, which is
the character name where the artist gave one).

## Attribution and why this is not committed

Art by "You see this." — <https://youseethis.blog/>. The artist's terms allow
free use in your VTT but state the art is *not* free stock art for publishing.
Committing it to a public repo and shipping it inside `module.zip` would be
publishing, so it is kept out of both. `docker/data/` is gitignored in full, and
the release workflow (which zips a clean checkout of `module/`) never sees the
art at all now that it lives outside the module tree.

Because it is in no checkout and no release, `./deploy` cannot carry it. Run
`./sync_tokens.sh` after a download run picks up something new.
