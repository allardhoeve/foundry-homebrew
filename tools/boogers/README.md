# boogers

Mirrors the token gallery at <https://youseethis.blog/tokens/> into the module's
asset tree.

```
cd tools/boogers
uv run python download_tokens.py            # download anything new
uv run python download_tokens.py --dry-run  # list what is missing, write nothing
uv run python download_tokens.py --force    # re-download everything
```

Tokens land in `module/assets/tokens/youseethis/`, which Foundry serves at
`modules/foundry-homebrew/assets/tokens/youseethis/<name>.png`.

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
publishing, so `module/assets/tokens/youseethis/` is gitignored and the release
workflow (which zips a clean checkout) never sees it.

Because it is not in a checkout, the regular `./deploy` excludes it. Push it to
production with `./deploy-tokens` instead, after a download run picks up
something new.
