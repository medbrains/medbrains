#!/usr/bin/env python3
"""Fetch the human-atlas anatomy model we pin, and publish it.

    python3 scripts/sync_anatomy_atlas.py                    # into apps/web/public/anatomy (dev)
    python3 scripts/sync_anatomy_atlas.py --upload s3://bucket/anatomy/<version>
    python3 scripts/sync_anatomy_atlas.py --check-upstream   # is there a newer upstream commit?

The body-site picker loads BodyParts3D 4.0 geometry packaged by
github.com/ashemag/human-atlas (code MIT; anatomy data CC BY 4.0 —
attribution shipped as ATTRIBUTION.md next to the files and shown in the
picker). It is ~33 MB gzipped, so it is never committed and never on first
paint: dev serves a local copy, production serves it from the CDN named by
VITE_ANATOMY_BASE_URL.

"Pull in when new": upstream is pinned by commit. `--check-upstream` reports a
newer commit; bump PINNED_COMMIT, run this, review ATTRIBUTION.md for licence
changes, and upload to a new versioned path — a model already on screen keeps
loading from its own path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

REPO = "ashemag/human-atlas"
PINNED_COMMIT = "1c38bf35c254a891200d3cedecfd57abebe83d8d"
RAW = f"https://raw.githubusercontent.com/{REPO}/{{commit}}/public/{{path}}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL = os.path.join(ROOT, "apps", "web", "public", "anatomy")


def fetch(path: str, commit: str) -> bytes:
    with urllib.request.urlopen(RAW.format(commit=commit, path=path), timeout=120) as resp:
        return resp.read()


def latest_upstream_commit() -> str:
    url = f"https://api.github.com/repos/{REPO}/commits/main"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)["sha"]


def download(dest: str, commit: str) -> dict[str, str]:
    """Write atlas.json, the gzip chunks and ATTRIBUTION.md; return sha256 per file."""
    os.makedirs(dest, exist_ok=True)
    atlas_raw = fetch("models/atlas.json", commit)
    atlas = json.loads(atlas_raw)
    files = {"atlas.json": atlas_raw, "ATTRIBUTION.md": fetch("ATTRIBUTION.md", commit)}
    for chunk in atlas["chunks"]:
        rel = chunk["gzip"].lstrip("/").removeprefix("models/")
        body = fetch(f"models/{rel}", commit)
        if len(body) != chunk["gzipBytes"]:
            raise SystemExit(f"{rel}: expected {chunk['gzipBytes']} bytes, got {len(body)}")
        files[rel] = body
    digests = {}
    for name, body in files.items():
        with open(os.path.join(dest, name), "wb") as fh:
            fh.write(body)
        digests[name] = hashlib.sha256(body).hexdigest()
    manifest = {"source": REPO, "commit": commit, "version": atlas["version"], "sha256": digests}
    with open(os.path.join(dest, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    return digests


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default=LOCAL)
    ap.add_argument("--upload", help="s3://bucket/prefix to publish to after download")
    ap.add_argument("--check-upstream", action="store_true")
    args = ap.parse_args()

    if args.check_upstream:
        latest = latest_upstream_commit()
        if latest == PINNED_COMMIT:
            print(f"up to date: {PINNED_COMMIT[:12]}")
            return 0
        print(f"newer upstream: {latest[:12]} (pinned {PINNED_COMMIT[:12]})")
        return 1

    digests = download(args.dest, PINNED_COMMIT)
    print(f"{len(digests)} files → {os.path.relpath(args.dest, ROOT)} (commit {PINNED_COMMIT[:12]})")
    if args.upload:
        # Chunks are gzip payloads; serve them with their real type so the
        # browser decodes nothing twice (the loader checks the magic bytes).
        subprocess.run(
            ["aws", "s3", "sync", args.dest, args.upload, "--cache-control",
             "public, max-age=31536000, immutable"],
            check=True,
        )
        print(f"uploaded → {args.upload}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
