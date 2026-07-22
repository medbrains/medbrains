#!/usr/bin/env python3
"""
Sharing Registry Coverage Check — verifies every object_type used at an
authorization call site is declared in the authz entity registry.

An unregistered object_type is not a lint problem, it is a live defect:

  * `grant_raw` rejects it outright, so the request 500s (medbrains-ipd
    `create_admission` did exactly this until `admission` was registered).
  * Callers that swallow the error write no tuple at all, so the grant is
    silently lost (`department` / `access_group` in medbrains-setup
    `create_user`).
  * `check` returns UnknownObjectType, and call sites that mask it with
    `.unwrap_or(false)` then deny every non-bypass role (`invoice`,
    `radiology_order`, `pharmacy_order`).

All six of those shipped and were found by hand. This check exists so the
seventh is found by CI.

Detection:
  - Walks every crate for authz calls and pulls the object_type argument
    by position: check(ctx, relation, object_type, id) is index 2,
    grant_raw(ctx, object_type, id, relation, ...) is index 1.
  - Only string literals are checked. A variable in that position cannot
    be resolved statically and is skipped rather than guessed at.
  - Cross-references crates/medbrains-authz/src/registry.rs ENTITIES.

Exit codes:
    0  Every literal object_type at an authz call site is registered
    1  One or more unregistered, or the registry is missing/empty
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES_DIR = REPO_ROOT / "medbrains" / "crates"

# The live registry. `medbrains-core/src/sharing/registry.rs` is the eventual
# home named in registry.rs's own docstring, but it has never landed — this
# check pointed there and so reported "Phase 3 deliverable" while the real
# registry accumulated six unregistered object_types.
REGISTRY_FILE = CRATES_DIR / "medbrains-authz" / "src" / "registry.rs"
FALLBACK_REGISTRY = CRATES_DIR / "medbrains-core" / "src" / "sharing" / "registry.rs"

# Test doubles live in src/ rather than tests/, and deliberately reference
# unregistered types to exercise the error path.
SKIP_PATH_PARTS = ("/tests/", "medbrains-seed", "backend_test.rs")

# method name -> zero-based index of object_type in the call's argument list
OBJECT_TYPE_ARG = {
    "check": 2,
    "check_any": 2,
    "grant": 1,
    "grant_raw": 1,
    "write_tuple": 1,
    "revoke": 1,
}
CALL_RE = re.compile(r"\.(" + "|".join(OBJECT_TYPE_ARG) + r")\s*\(")
STRING_LITERAL_RE = re.compile(r'^"([a-z_][a-z0-9_]*)"$')
ENTITY_SPEC_RE = re.compile(r'object_type:\s*"([a-z_][a-z0-9_]*)"')


def split_args(src: str, open_paren: int) -> list[str] | None:
    """Split one call's arguments at paren depth 0. None if unbalanced."""
    depth, start, args = 1, open_paren + 1, []
    i = start
    while i < len(src) and depth > 0:
        c = src[i]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                args.append(src[start:i].strip())
                return args
        elif c == "," and depth == 1:
            args.append(src[start:i].strip())
            start = i + 1
        elif c == '"':  # skip string bodies so commas inside them do not split
            i += 1
            while i < len(src) and src[i] != '"':
                i += 2 if src[i] == "\\" else 1
        i += 1
    return None


def main() -> int:
    registry = REGISTRY_FILE if REGISTRY_FILE.exists() else FALLBACK_REGISTRY
    if not registry.exists():
        print(f"❌ authz registry not found at {REGISTRY_FILE.relative_to(REPO_ROOT)}")
        return 1

    registered = set(ENTITY_SPEC_RE.findall(registry.read_text(encoding="utf-8")))
    if not registered:
        print(f"❌ {registry.relative_to(REPO_ROOT)} declares no entities.")
        return 1

    used: dict[str, list[str]] = {}
    for rs_file in CRATES_DIR.rglob("*.rs"):
        if any(part in str(rs_file) for part in SKIP_PATH_PARTS):
            continue
        if rs_file == registry:
            continue
        try:
            text = rs_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for match in CALL_RE.finditer(text):
            args = split_args(text, match.end() - 1)
            if args is None:
                continue
            index = OBJECT_TYPE_ARG[match.group(1)]
            if len(args) <= index:
                continue
            literal = STRING_LITERAL_RE.match(args[index])
            if not literal:
                continue  # a variable — not resolvable statically
            line = text[: match.start()].count("\n") + 1
            used.setdefault(literal.group(1), []).append(
                f"{rs_file.relative_to(REPO_ROOT)}:{line}"
            )

    missing = sorted(set(used) - registered)
    print(
        f"Registry: {len(registered)} entities. "
        f"Authz call sites reference {len(used)} literal object_types."
    )

    if missing:
        print(f"\n=== {len(missing)} UNREGISTERED object_type AT AN AUTHZ CALL SITE ===")
        for entity in missing:
            print(f"  ✗ {entity}")
            for site in used[entity][:5]:
                print(f"      {site}")
        print(
            "\nRegister these in crates/medbrains-authz/src/registry.rs ENTITIES, "
            "or the grant fails and the check silently denies."
        )
        return 1

    print("✓ Every object_type used at an authz call site is registered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
