#!/usr/bin/env python3
"""Every permission a guard checks must exist in the catalogue.

    python3 scripts/check_permission_codes_defined.py

`require_permission` grants nothing on its own — it asks whether the caller
holds a code:

    if claims.permissions.iter().any(|p| p == perm) { return Ok(()); }
    Err(AppError::Forbidden)

So a code that no role can hold is a code nobody can satisfy. It does not fail
loudly; it returns 403 to every non-bypass caller, forever, while
`super_admin` and `hospital_admin` sail through and make the module look fine.
Worse, an administrator cannot repair it, because the admin UI can only grant
codes that reach the generated catalogue — and the catalogue is generated from
`permissions.rs`.

Two ways in, both found in the wild:

    require_permission(&claims, "specialty.clinical_trials.create")
    const ABDM_HFR_VIEW: &str = "abdm.hfr.view";   // …then passed to it

The first cost the whole clinical-trials module — twenty handlers usable only
by bypass roles, so a research coordinator could not run a trial. The second
cost the ABDM integration the same way, and the frontend guarded on the same
literal, so the control was hidden as well as the route refused.

Neither is caught by the compiler: a `&str` is a `&str`. Hence this check.

It resolves a guard's argument when the argument is a literal or a local
`const`, and reports any resulting code that `permissions.rs` does not define.
A `permissions::…` path needs no check — the compiler already did it, which is
exactly why the typed constants are the right way to write these.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
CATALOGUE = os.path.join(CRATES, "medbrains-core", "src", "permissions.rs")

GUARD = re.compile(
    r"require_(?:permission|any_permission|all_permissions)\(\s*&?claims\s*,\s*([^)\n]+)"
)
LOCAL_CONST = re.compile(r'const ([A-Z_0-9]+): &str = "([a-z0-9_.]+)"')
# A dotted lowercase string in permissions.rs is a permission code.
DEFINED = re.compile(r'"([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)"')


def defined_codes() -> set[str]:
    return set(DEFINED.findall(open(CATALOGUE, encoding="utf-8").read()))


def offenders(catalogue: set[str]) -> list[tuple[str, int, str, str]]:
    found: list[tuple[str, int, str, str]] = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            if os.path.samefile(path, CATALOGUE) if os.path.exists(path) else False:
                continue
            rel = os.path.relpath(path, ROOT)
            if rel.endswith("medbrains-core/src/permissions.rs"):
                continue
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue

            consts = dict(LOCAL_CONST.findall(text))
            for match in GUARD.finditer(text):
                arg = match.group(1).strip().rstrip(",")
                if arg.startswith('"'):
                    code, how = arg.strip('"'), "literal"
                elif re.fullmatch(r"[A-Z_0-9]+", arg) and arg in consts:
                    code, how = consts[arg], f"const {arg}"
                else:
                    continue  # a `permissions::…` path — the compiler has it
                if code in catalogue:
                    continue
                line = text[: match.start()].count("\n") + 1
                found.append((rel, line, code, how))
    return found


def main() -> int:
    catalogue = defined_codes()
    found = offenders(catalogue)

    if not found:
        print(f"✓ every guarded permission code is defined ({len(catalogue)} in the catalogue)")
        return 0

    print(f"{len(found)} guard(s) check a permission that does not exist:\n")
    for rel, line, code, how in sorted(found):
        print(f"   {rel}:{line}")
        print(f"      {code}   ({how})")
    print(
        "\nDefine it in crates/medbrains-core/src/permissions.rs with a `///` doc\n"
        "comment, grant it to the roles that need it in access/roles.rs, regenerate\n"
        "the catalogue, and reference the constant rather than the string. Until\n"
        "then this guard returns 403 to every caller who is not a bypass role, and\n"
        "no administrator can grant their way past it."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
