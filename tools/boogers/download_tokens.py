"""
Mirror the token gallery at https://youseethis.blog/tokens/ into the module's
asset tree.

The gallery is a single WordPress page.  Every token is a <figure> whose <img>
carries a `data-orig-file` attribute pointing at the full-size PNG, and often a
<figcaption> with the character's name.  We take the original file (not the
`src`, which is a resized variant) and keep the upstream filename, which is
already descriptive: cleric_greeshma_fbb.png, black_dragon_fbb.png, and so on.

The run is idempotent: a token already on disk is left alone, so re-running
after the artist adds to the page downloads only what is new.  Downloads go to
a .part file and are renamed into place, so an interrupted run never leaves a
truncated PNG that a later run would mistake for a finished one.

Art by "You see this." (https://youseethis.blog/).  Free to use in your VTT,
not free stock art for publishing -- see CREDITS.md written alongside the
tokens.

Usage:
    uv run python download_tokens.py
    uv run python download_tokens.py --dry-run
    uv run python download_tokens.py --force --workers 8
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

INDEX_URL = "https://youseethis.blog/tokens/"
SITE_NAME = '"You see this."'
SITE_URL = "https://youseethis.blog/"

# Layout filler the page repeats between rows, not a token.
SKIP_FILENAMES = {"stupid-spacer.png"}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "module/assets/tokens/youseethis"

CREDITS = f"""# Token art credits

All token art in this directory is by {SITE_NAME} -- {SITE_URL}

Source page: {INDEX_URL}

The artist's terms, quoted from that page:

> My patrons (free and paid) get notified as I add to the menu, and help decide
> what I add next.
> I combined types that are easily interchangeable (Fighters+Mercs, Dwarves+Gnomes)
> Art that was reimagined directly from another artist's work has been credited
> in italics
> Some characters have names. To find a popular NPC use Cntrl+F to search the
> page (Find In Page, mobile)
> These are not free stock art for publishing, but they are free to use in your
> VTTs.

These files are mirrored for use in this Foundry world only.  They are not
committed to the repository and are not shipped in the module release.

Mirrored by tools/boogers/download_tokens.py.  See manifest.json for the
per-token source URL and caption.
"""


@dataclass(frozen=True)
class Token:
    """One token on the gallery page."""

    filename: str
    url: str
    caption: str


def fetch_index(client: httpx.Client, url: str) -> str:
    response = client.get(url)
    response.raise_for_status()
    return response.text


def parse_tokens(html: str) -> list[Token]:
    """Pull every token out of the page's entry content, in page order."""
    soup = BeautifulSoup(html, "lxml")

    content = soup.select_one("div.entry-content")
    if content is None:
        raise SystemExit("Could not find div.entry-content -- the page layout changed.")

    tokens: dict[str, Token] = {}
    for img in content.select("img[data-orig-file]"):
        url = img["data-orig-file"]
        filename = Path(urlparse(url).path).name
        if not filename or filename in SKIP_FILENAMES:
            continue

        figure = img.find_parent("figure")
        figcaption = figure.find("figcaption") if figure else None
        caption = figcaption.get_text(strip=True) if figcaption else ""

        # The page reuses a handful of tokens across sections; first one wins.
        tokens.setdefault(filename, Token(filename=filename, url=url, caption=caption))

    if not tokens:
        raise SystemExit("Found no tokens on the page -- the page layout changed.")

    return sorted(tokens.values(), key=lambda t: t.filename)


def download(client: httpx.Client, token: Token, out_dir: Path) -> None:
    """Download one token, writing to a .part file and renaming on success."""
    destination = out_dir / token.filename
    partial = destination.with_suffix(destination.suffix + ".part")

    with client.stream("GET", token.url) as response:
        response.raise_for_status()
        with partial.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)

    partial.replace(destination)


def write_metadata(tokens: list[Token], out_dir: Path) -> None:
    manifest = [
        {"file": token.filename, "caption": token.caption, "source": token.url}
        for token in tokens
    ]
    (out_dir / "manifest.json").write_text(
        json.dumps(
            {
                "source_page": INDEX_URL,
                "artist": SITE_NAME,
                "artist_url": SITE_URL,
                "tokens": manifest,
            },
            indent=2,
        )
        + "\n"
    )
    (out_dir / "CREDITS.md").write_text(CREDITS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Directory to mirror into (default: {DEFAULT_OUT})",
    )
    parser.add_argument("--index-url", default=INDEX_URL, help="Gallery page to read")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be downloaded without writing anything",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download tokens that are already on disk",
    )
    parser.add_argument(
        "--workers", type=int, default=4, help="Parallel downloads (default: 4)"
    )
    args = parser.parse_args()

    headers = {"User-Agent": USER_AGENT}
    transport = httpx.HTTPTransport(retries=3)

    with httpx.Client(
        headers=headers, transport=transport, timeout=30.0, follow_redirects=True
    ) as client:
        print(f"Reading {args.index_url}")
        tokens = parse_tokens(fetch_index(client, args.index_url))
        print(f"Found {len(tokens)} tokens")

        if args.force:
            missing = tokens
        else:
            missing = [t for t in tokens if not (args.out / t.filename).exists()]
        already = len(tokens) - len(missing)

        if args.dry_run:
            for token in missing:
                print(f"  would download {token.filename}")
            print(f"\n{len(missing)} to download, {already} already on disk")
            return 0

        args.out.mkdir(parents=True, exist_ok=True)

        failures: list[tuple[Token, Exception]] = []

        def run(token: Token) -> None:
            try:
                download(client, token, args.out)
                print(f"  downloaded {token.filename}")
            except Exception as error:  # noqa: BLE001 - report and keep going
                failures.append((token, error))
                print(f"  FAILED {token.filename}: {error}", file=sys.stderr)

        if missing:
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                list(pool.map(run, missing))

        write_metadata(tokens, args.out)

        downloaded = len(missing) - len(failures)
        print(
            f"\n{downloaded} downloaded, {already} already on disk, "
            f"{len(failures)} failed -> {args.out}"
        )

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
