#!/usr/bin/env python3
"""Raw key bytes go through `medbrains-crypto/src/keys*`, nowhere else.

    python3 scripts/check_raw_key_bytes.py            # check (make check-raw-key-bytes)
    python3 scripts/check_raw_key_bytes.py --update   # rewrite the baseline

The eMudhra CA incident: a script truncated private keys and nothing checked
the result. A key built straight from bytes (`SigningKey::from_bytes`, ...)
skips every check `keys` makes — length, a repeated byte, the matching public
key, a weak point — so a cut or zeroed key signs as if it were whole. The same
goes for a new in-repo development key, a hand-rolled `MEDBRAINS_ENV ==
"production"` test (unknown values must read as production; the one rule is
`secrets::sealing`), and `tail -c` / `head -c` on key material in shell.

A per-file, per-rule ratchet: `scripts/raw_key_bytes.baseline.json` holds the
sites that existed when the check landed. A file may only lose sites; a new
one fails. Tests (`tests/`, `*_tests.rs`, `#[cfg(test)]` modules, `test-*.sh`)
are exempt.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = Path(__file__).resolve().parent / "raw_key_bytes.baseline.json"
EXEMPT_PREFIX = "crates/medbrains-crypto/src/keys"

RUST_RULES = {
    "raw-key-constructor": re.compile(
        r"\b(?:SigningKey::from_bytes|VerifyingKey::from_bytes|EncodingKey::from_ed_\w+"
        r"|DecodingKey::from_ed_\w+|Aes256Gcm::new_from_slice|PKey::public_key_from_der)\b"
    ),
    "dev-key-const": re.compile(r"\bconst\s+DEV_\w*KEY\w*\s*:"),
    # MEDBRAINS_ENV, then a literal comparison before the statement ends.
    "env-literal-compare": re.compile(
        r"\"MEDBRAINS_ENV\"[^;]{0,160}?(?:[=!]=\s*\"|Some\(\")", re.S
    ),
}
SHELL_RULE = "shell-key-truncation"
SHELL_CUT = re.compile(r"\b(?:tail|head)\s+-c\b")
SHELL_KEY = re.compile(r"key|\.der\b|\.pem\b|priv|pub|spki|seed|secret", re.I)


def strip_test_module(text: str) -> str:
    """Drop everything from the first top-level `#[cfg(test)]` on."""
    match = re.search(r"^#\[cfg\(test\)\]", text, re.M)
    return text[: match.start()] if match else text


def is_test_path(rel: str) -> bool:
    """Whether `rel` is test code, which may build keys from raw bytes."""
    name = rel.rsplit("/", 1)[-1]
    return "/tests/" in f"/{rel}" or name.endswith("_tests.rs") or name in {"tests.rs", "test.rs"}


def rust_sites(rel: str, text: str) -> dict[str, int]:
    """Count each Rust rule's matches outside test code."""
    body = strip_test_module(text)
    counts = {rule: len(rx.findall(body)) for rule, rx in RUST_RULES.items()}
    return {rule: n for rule, n in counts.items() if n}


def shell_sites(text: str) -> dict[str, int]:
    """Count `tail -c` / `head -c` lines that touch key material."""
    n = sum(1 for line in text.splitlines() if SHELL_CUT.search(line) and SHELL_KEY.search(line))
    return {SHELL_RULE: n} if n else {}


def is_shell(path: Path) -> bool:
    """A `.sh` file, or an extensionless script with a shell shebang."""
    if path.suffix == ".sh":
        return True
    if path.suffix:
        return False
    try:
        with path.open("rb") as handle:
            first = handle.readline(80)
    except OSError:
        return False
    return first.startswith(b"#!") and (b"sh" in first)


def scan() -> dict[str, dict[str, int]]:
    """Map relative path -> rule -> count, for every non-exempt file."""
    found: dict[str, dict[str, int]] = {}
    for path in sorted((ROOT / "crates").rglob("*.rs")):
        rel = path.relative_to(ROOT).as_posix()
        if "/target/" in rel or rel.startswith(EXEMPT_PREFIX) or is_test_path(rel):
            continue
        sites = rust_sites(rel, path.read_text(encoding="utf-8", errors="replace"))
        if sites:
            found[rel] = sites
    for top in ("deploy", "os", "scripts", "infra"):
        for path in sorted((ROOT / top).rglob("*")):
            rel = path.relative_to(ROOT).as_posix()
            if not path.is_file() or path.name.startswith("test-") or not is_shell(path):
                continue
            sites = shell_sites(path.read_text(encoding="utf-8", errors="replace"))
            if sites:
                found[rel] = sites
    return found


def main(argv: list[str]) -> int:
    """Compare the scan with the baseline; `--update` rewrites it."""
    found = scan()
    if "--update" in argv:
        BASELINE.write_text(json.dumps(found, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"check-raw-key-bytes: baseline written, {len(found)} file(s)")
        return 0
    baseline = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else {}
    new = [
        (rel, rule, n, baseline.get(rel, {}).get(rule, 0))
        for rel, sites in found.items()
        for rule, n in sites.items()
        if n > baseline.get(rel, {}).get(rule, 0)
    ]
    if new:
        print("check-raw-key-bytes: new raw key handling outside medbrains-crypto/src/keys*:\n")
        for rel, rule, n, allowed in new:
            print(f"  {rel}: {rule} x{n} (baseline {allowed})")
        print(
            "\nLoad keys through medbrains_crypto::keys (length, repeated-byte, pair and"
            " weak-point checks); decide dev keys and modes through"
            " medbrains_core::secrets::sealing; never cut key bytes with tail/head -c."
        )
        return 1
    print(f"check-raw-key-bytes: ok ({sum(map(len, found.values()))} grandfathered site kinds)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
