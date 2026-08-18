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

The web app is checked the same way. `useRequirePermission("abdm.hfr.view")`
had the same defect from the other side: the page hid its control while the
route refused the call, so the screen looked deliberately restricted rather
than broken. TypeScript cannot catch it either — a string literal satisfies
`string`. Use `P.MODULE.ACTION` and the compiler does the work.
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


WEB = os.path.join(ROOT, "apps", "web", "src")
HOOK = re.compile(
    r"(?:useRequirePermission|useHasPermission|useHasAllPermissions|useHasAnyPermission)"
    r'\(\s*\[?\s*((?:"[a-z0-9_.]+"\s*,?\s*)+)'
)


def web_offenders(catalogue: set[str]) -> list[tuple[str, int, str, str]]:
    """Raw permission strings in the web app that the catalogue does not define."""
    found: list[tuple[str, int, str, str]] = []
    if not os.path.isdir(WEB):
        return found
    for dirpath, dirs, files in os.walk(WEB):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "dist")]
        for name in files:
            if not name.endswith((".ts", ".tsx")):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            for match in HOOK.finditer(text):
                for code in re.findall(r'"([a-z0-9_.]+)"', match.group(1)):
                    if code in catalogue:
                        continue
                    line = text[: match.start()].count("\n") + 1
                    found.append((rel, line, code, "web literal"))
    return found


def literal_guards() -> list[tuple[str, int, str]]:
    """Rust guards passing a bare string where a constant belongs.

    A literal that happens to name a real permission is not an outage today, but
    it is the shape every outage in this sweep arrived in: a typo in a `&str` is
    a silent 403 for everyone, while a typo in `permissions::module::ACTION` does
    not compile. The count is zero, so it is worth holding at zero.

    Only literals are reported. A guard whose argument is a variable or an
    expression is left alone — that is a deliberate dynamic check, not a typo
    waiting to happen.
    """
    found: list[tuple[str, int, str]] = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            if rel.endswith("medbrains-core/src/permissions.rs"):
                continue
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            for match in GUARD.finditer(text):
                arg = match.group(1).strip().rstrip(",")
                if not arg.startswith('"'):
                    continue
                found.append((rel, text[: match.start()].count("\n") + 1, arg.strip('"')))
    return found


def main() -> int:
    catalogue = defined_codes()
    found = offenders(catalogue) + web_offenders(catalogue)
    literals = literal_guards()

    if not found and not literals:
        print(f"✓ every guarded permission code is defined ({len(catalogue)} in the catalogue)")
        print("✓ no Rust guard passes a bare string instead of a constant")
        return 0

    if literals:
        print(f"{len(literals)} Rust guard(s) pass a bare string where a constant belongs:\n")
        for rel, line, code in sorted(literals):
            print(f"   {rel}:{line}\n      \"{code}\"")
        print(
            "\nUse `permissions::module::ACTION`. A typo in a literal is a silent 403\n"
            "for every caller; a typo in a constant does not compile. If the argument\n"
            "genuinely has to be dynamic, pass a variable — only literals are flagged.\n"
        )
        if not found:
            return 1

    print(f"{len(found)} guard(s) check a permission that does not exist:\n")
    for rel, line, code, how in sorted(found):
        print(f"   {rel}:{line}")
        print(f"      {code}   ({how})")
    print(
        "\nDefine it in crates/medbrains-core/src/permissions.rs with a `///` doc\n"
        "comment, grant it to the roles that need it in access/roles.rs, regenerate\n"
        "the catalogue, and reference the constant rather than the string — in Rust\n"
        "`permissions::module::ACTION`, in the web app `P.MODULE.ACTION`. Until then\n"
        "this guard returns 403 to every caller who is not a bypass role, no\n"
        "administrator can grant their way past it, and a `web literal` offender\n"
        "additionally hides the control so the screen looks restricted, not broken."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
