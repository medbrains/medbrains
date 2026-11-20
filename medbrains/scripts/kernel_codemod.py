#!/usr/bin/env python3
"""Move an app crate's mechanical direct-core calls onto the kernel.

    python3 scripts/kernel_codemod.py crates/medbrains-<app>          # rewrite in place
    python3 scripts/kernel_codemod.py crates/medbrains-<app> --dry    # report only
    python3 scripts/kernel_codemod.py --self-test

RFC-HOSPITAL-OS §3, phase K2. `check_kernel_boundary.py` counts the sites; this
removes the ones that have a one-to-one kernel equivalent, so a crate's move is
one reviewable mechanical commit plus a short hand-fix commit. Every rewrite
calls the same `medbrains_db` / `medbrains_authz` code through the kernel's thin
wrapper (named in `crates/medbrains-kernel/src/tenancy.rs`), so SQL, tenant
context, permission codes and HTTP errors do not change.

Rewrites:

- `let mut tx = <pool>.begin().await?;` followed by `set_tenant_context` /
  `set_full_context` / `set_audit_context` on it -> `kernel::tenant_tx` /
  `scoped_tx` / `actor_tx`;
- a lone setter on an open transaction -> `kernel::enter_tenant` / `enter_scope`;
- `tenant_conn` -> `kernel::tenant_session`;
- `AuditLogger::log` -> `kernel::audit::append`, `AuditEntry` from the kernel;
- `medbrains_authz::` (Relation, Subject, Outcome) -> `kernel::authz::`;
- `medbrains_authz_gate::` -> `gate::`, i.e. `medbrains_health_services::patient`
  (the gate's home above the kernel, RFC §3a);
- `medbrains_server_core::middleware::authorization::` items that live in
  `medbrains_kernel::authz` (imports, use trees, qualified calls) -> the kernel.

Rewritten paths are short (`kernel::…`, `gate::…`) under a per-file
`use medbrains_kernel as kernel;` / `use medbrains_health_services::patient as gate;`
it adds, so lines do not grow and wrap (the function-size ratchet counts lines).

Then `[dependencies]` drops `medbrains-db`, `medbrains-authz` and
`medbrains-authz-gate` when nothing outside tests names them (tests keep them as
dev-dependencies) and gains the kernel / health services as needed.

What it leaves is printed: those are the hand fixes. Run `cargo fmt -p` after.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

K = "kernel"  # emitted as `kernel::…` under `use medbrains_kernel as kernel;`
GATE = "gate"  # `use medbrains_health_services::patient as gate;`
ALIASES = {K: "use medbrains_kernel as kernel;", GATE: "use medbrains_health_services::patient as gate;"}
OPENERS = {
    "set_tenant_context": "tenant_tx",
    "set_full_context": "scoped_tx",
    "set_audit_context": "actor_tx",
}
ENTER = {"set_tenant_context": "enter_tenant", "set_full_context": "enter_scope"}
# What `medbrains_server_core::middleware::authorization` re-exports or wraps
# one-for-one from `medbrains_kernel::authz` (same names, KernelError -> AppError
# through `?`).
KERNEL_AUTHZ = {
    "BYPASS_ROLES", "authz_context", "collapse", "is_bypass_role", "outcome_of",
    "require_any_permission", "require_permission",
}
SC_AUTHZ = "medbrains_server_core::middleware::authorization::"
BEGIN = re.compile(r"let mut (\w+) = (&?[\w.]+)\.begin\(\)\.await\?;\s*")


def close_paren(text: str, start: int) -> int:
    """Index just past the `)` matching the `(` at `start - 1`."""
    depth = 1
    i = start
    while depth and i < len(text):
        depth += {"(": 1, ")": -1}.get(text[i], 0)
        i += 1
    return i


def pool_ref(expr: str) -> str:
    """`state.db` -> `&state.db`; a bare name is assumed to already be `&PgPool`."""
    return expr if expr.startswith("&") or "." not in expr else f"&{expr}"


def collapse_openers(text: str, k: str) -> str:
    """Fold `begin()` + an immediate context setter on the same tx into one kernel call."""
    out, pos = [], 0
    for m in BEGIN.finditer(text):
        tx, pool = m.group(1), m.group(2)
        rest = text[m.end():]
        call = re.match(r"medbrains_db::pool::(\w+)\(\s*&mut " + re.escape(tx) + r",\s*", rest)
        if not call or call.group(1) not in OPENERS:
            continue
        args_start = m.end() + call.end()
        args_end = close_paren(text, args_start)
        tail = re.match(r"\s*\.await\?;", text[args_end:])
        if not tail:
            continue
        args = text[args_start:args_end - 1].strip().rstrip(",")
        fn = OPENERS[call.group(1)]
        out.append(text[pos:m.start()])
        out.append(f"let mut {tx} = {k}::{fn}({pool_ref(pool)}, {args}).await?;")
        pos = args_end + tail.end()
    out.append(text[pos:])
    return "".join(out)


def rewrite_authz_imports(text: str, k: str) -> str:
    """Point server-core authorization imports at the kernel when every item is there."""

    def swap(m: re.Match) -> str:
        """Re-point one `use …::authorization::…` when the kernel has every item it names."""
        items = {i.strip() for i in m.group(2).strip("{}").split(",") if i.strip()}
        return f"{m.group(1)}medbrains_kernel::authz::{m.group(2)}" if items <= KERNEL_AUTHZ else m.group(0)

    text = re.sub(r"(use )" + re.escape(SC_AUTHZ) + r"(\{[^}]*\}|\w+)", swap, text)
    text = re.sub(r"use medbrains_server_core::\{.*?\};\n", lift_from_tree, text, flags=re.S)
    # Fully qualified calls: `medbrains_server_core::middleware::authorization::outcome_of(`.
    return re.sub(
        re.escape(SC_AUTHZ) + r"(\w+)",
        lambda m: f"{k}::authz::{m.group(1)}" if m.group(1) in KERNEL_AUTHZ else m.group(0),
        text,
    )


def lift_from_tree(m: re.Match) -> str:
    """Take kernel-owned items out of a `use medbrains_server_core::{…}` tree into their own `use`."""
    lifted: list[str] = []

    def take(item: re.Match) -> str:
        """Remove a kernel-owned item from the tree, remembering it for its own `use`."""
        if item.group(2) not in KERNEL_AUTHZ:
            return item.group(0)
        lifted.append(item.group(2))
        return ""

    tree = re.sub(r"(middleware::)?authorization::(\w+),?\s*", take, m.group(0))
    if not lifted:
        return m.group(0)
    tree = re.sub(r"middleware::\{\s*\},?\s*", "", tree)
    items = ", ".join(sorted(lifted))
    return f"{tree}use medbrains_kernel::authz::{{{items}}};\n"


def rewrite(text: str) -> str:
    """Rewrite non-test code with short aliases and inline test modules with full paths.

    A test module does not see the file's `use` aliases unless it globs `super`, and
    an alias only tests use would be an unused import outside them.
    """
    code, tests = [], []
    for is_test, chunk in chunks(text):
        (tests if is_test else code).append(rewrite_chunk(chunk, short=not is_test))
    out, ci, ti = [], iter(code), iter(tests)
    for is_test, _ in chunks(text):
        out.append(next(ti) if is_test else next(ci))
    return add_aliases(prune_imports("".join(out)))


def prune_imports(text: str) -> str:
    """Drop kernel authz imports that permit threading left unused."""

    def prune(m: re.Match) -> str:
        """Keep only the items of one kernel authz `use` that the file still names."""
        items = [i.strip() for i in m.group(1).strip("{}").split(",") if i.strip()]
        rest = text[: m.start()] + text[m.end():]
        kept = [i for i in items if re.search(rf"\b{i}\b", rest)]
        if not kept:
            return ""
        return f"use medbrains_kernel::authz::{kept[0] if len(kept) == 1 else '{' + ', '.join(kept) + '}'};\n"

    return re.sub(r"^use medbrains_kernel::authz::(\{[^}]*\}|\w+);\n", prune, text, flags=re.M)


def chunks(text: str) -> list[tuple[bool, str]]:
    """The file as (is inline test module, text) pieces that join back to it exactly."""
    pieces, buf, lines = [], [], iter(text.splitlines(keepends=True))
    for line in lines:
        if line.startswith("#[cfg(test)]"):
            head = next(lines, "")
            if re.match(r"mod \w+ \{", head):
                pieces.append((False, "".join(buf)))
                buf = [line, head]
                depth = head.count("{") - head.count("}")
                while depth > 0 and (body := next(lines, None)) is not None:
                    buf.append(body)
                    depth += body.count("{") - body.count("}")
                pieces.append((True, "".join(buf)))
                buf = []
                continue
            buf += [line, head]
            continue
        buf.append(line)
    pieces.append((False, "".join(buf)))
    return pieces


def rewrite_chunk(text: str, short: bool) -> str:
    """Every mechanical rewrite on one piece, in order; idempotent."""
    k, gate = (K, GATE) if short else ("medbrains_kernel", "medbrains_health_services::patient")
    text = rewrite_paths(text, k, gate)
    return thread_permits(text, k) if short else text


OPENER = re.compile(r"\b(?:kernel|medbrains_kernel)::(tenant_tx|scoped_tx|actor_tx|tenant_session|enter_tenant|enter_scope)\(")
DECISION = re.compile(r"^([ \t]*)((?:[\w:]+::)?require_(any_)?permission)\(", re.M)


def fn_bodies(text: str) -> list[tuple[int, int]]:
    """(start, end) of each outermost `fn` body, by brace matching from its signature."""
    spans, pos = [], 0
    while m := re.compile(r"\bfn \w+").search(text, pos):
        i, parens = m.end(), 0
        while i < len(text) and not (text[i] == "{" and parens == 0):
            parens += {"(": 1, ")": -1}.get(text[i], 0)
            if text[i] == ";" and parens == 0:
                break  # a trait method without a body
            i += 1
        if i >= len(text) or text[i] != "{":
            pos = m.end()
            continue
        depth, j = 1, i + 1
        while depth and j < len(text):
            depth += {"{": 1, "}": -1}.get(text[j], 0)
            j += 1
        spans.append((i, j))
        pos = j
    return spans


def split_args(inner: str) -> list[str]:
    """Top-level comma-separated arguments of a call."""
    args, depth, cur = [], 0, ""
    for ch in inner:
        depth += {"(": 1, "[": 1, "{": 1, ")": -1, "]": -1, "}": -1}.get(ch, 0)
        if ch == "," and depth == 0:
            args.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        args.append(cur.strip())
    return args


def thread_permits(text: str, k: str) -> str:
    """Make each opener take the `Permit` from the permission check before it.

    In each function, the first `require_permission(claims, …)?;` /
    `require_any_permission(claims, …)?;` statement before the first opener becomes
    `let permit = kernel::authz::permit[_any](claims, …)?;`, and every opener whose
    tenant is `claims.tenant_id` (and, for `actor_tx`, whose user is `claims.sub`)
    takes `&permit` instead. Same check, same refusal. An opener with no decision
    before it is left on its old arguments, which no longer compile: that is a
    hand fix, by design.
    """
    for start, end in reversed(fn_bodies(text)):
        body = text[start:end]
        first = OPENER.search(body)
        if not first or "let permit = " in body:
            continue
        decision = next(
            (d for d in DECISION.finditer(body, 0, first.start())),
            None,
        )
        if not decision:
            continue
        args_end = close_paren(body, decision.end())
        tail = re.match(r"\s*\?;", body[args_end:])
        claims = split_args(body[decision.end():args_end - 1])[0].lstrip("&")
        if not tail or not re.fullmatch(r"\w+", claims):
            continue
        new_body, threaded = rethread_openers(body, claims)
        if not threaded:
            continue
        kind = "permit_any" if decision.group(3) else "permit"
        stmt = f"{decision.group(1)}let permit = {k}::authz::{kind}("
        new_body = new_body[: decision.start()] + stmt + new_body[decision.end():]
        text = text[:start] + new_body + text[end:]
    return text


def rethread_openers(body: str, claims: str) -> tuple[str, int]:
    """Swap `&claims.tenant_id` (and `&claims.sub` for `actor_tx`) for `&permit` in openers."""
    out, pos, threaded = [], 0, 0
    for m in OPENER.finditer(body):
        end = close_paren(body, m.end())
        args = split_args(body[m.end():end - 1])
        tenant = {f"&{claims}.tenant_id", f"{claims}.tenant_id"}
        if len(args) < 2 or args[1] not in tenant:
            continue
        if m.group(1) == "actor_tx":
            if len(args) != 4 or args[2].lstrip("&") != f"{claims}.sub":
                continue
            args = [args[0], "&permit", args[3]]
        else:
            args = [args[0], "&permit", *args[2:]]
        out.append(body[pos:m.end()] + ", ".join(args) + ")")
        pos = end
        threaded += 1
    out.append(body[pos:])
    return "".join(out), threaded


def rewrite_paths(text: str, k: str, gate: str) -> str:
    """The rewrites themselves, emitting `k::…` for the kernel and `gate::…` for the gate."""
    text = collapse_openers(text, k)
    for old, new in ENTER.items():
        text = text.replace(f"medbrains_db::pool::{old}(", f"{k}::{new}(")
    text = text.replace("medbrains_db::pool::tenant_conn(", f"{k}::tenant_session(")
    text = text.replace("medbrains_db::audit::AuditLogger::log(", f"{k}::audit::append(")
    text = text.replace("medbrains_db::audit::AuditEntry", f"{k}::audit::AuditEntry")
    text = text.replace("medbrains_authz::decision::Outcome", f"{k}::authz::Outcome")
    text = re.sub(r"\bmedbrains_authz::", f"{k}::authz::", text)
    text = re.sub(r"\bmedbrains_authz_gate::", f"{gate}::", text)
    return rewrite_authz_imports(text, k)


def add_aliases(text: str) -> str:
    """Declare `kernel` / `gate` once per file whose non-test code now names them."""
    code = "".join(c for is_test, c in chunks(text) if not is_test)
    for alias, decl in ALIASES.items():
        if decl in text or not re.search(rf"(?<![\w:]){alias}::", code):
            continue
        first_use = re.search(r"^use ", text, re.M)
        if first_use:
            text = text[: first_use.start()] + decl + "\n" + text[first_use.start():]
        else:
            docs = re.match(r"(?://![^\n]*\n)*\n?", text)
            text = text[: docs.end()] + decl + "\n" + text[docs.end():]
    return text


def split_tests(text: str) -> tuple[str, str]:
    """(non-test code, inline `#[cfg(test)]` modules), the way the boundary check splits them."""
    pieces = chunks(text)
    return (
        "".join(c for is_test, c in pieces if not is_test),
        "".join(c for is_test, c in pieces if is_test),
    )


def fix_manifest(crate: Path, sources: list[str]) -> list[str]:
    """Drop kernel internals from `[dependencies]` once only tests name them; add the facade."""
    manifest = crate / "Cargo.toml"
    text = manifest.read_text(encoding="utf-8")
    code = "\n".join(split_tests(s)[0] for s in sources)
    tests = "\n".join(split_tests(s)[1] for s in sources) + "\n".join(
        p.read_text(encoding="utf-8") for p in sorted(crate.glob("tests/**/*.rs"))
    )
    notes = []
    for dep in ("medbrains-db", "medbrains-authz", "medbrains-authz-gate"):
        ident = dep.replace("-", "_")
        line = re.search(rf"^{re.escape(dep)} = .*\n", text, re.M)
        if not line or re.search(rf"\b{ident}::", code):
            if line:
                notes.append(f"{dep}: still named outside tests, kept")
            continue
        text = text.replace(line.group(0), "", 1)
        if re.search(rf"\b{ident}::", tests) and not re.search(
            rf"\[dev-dependencies\][^\[]*^{re.escape(dep)} =", text, re.M | re.S
        ):
            text = text.replace("[dev-dependencies]\n", f"[dev-dependencies]\n{line.group(0)}", 1)
        notes.append(f"{dep}: dropped from [dependencies]")
    for dep, ident in (("medbrains-kernel", K), ("medbrains-health-services", "medbrains_health_services")):
        if re.search(rf"\b{ident}::", code) and not re.search(rf"^{dep} = ", text, re.M):
            text = text.replace("[dependencies]\n", f'[dependencies]\n{dep} = {{ path = "../{dep}" }}\n', 1)
            notes.append(f"{dep}: added")
    manifest.write_text(text, encoding="utf-8")
    return notes


def self_test() -> int:
    """The rewrites the codemod promises, on the shapes the apps actually contain."""
    src = (
        "    let mut tx = state.db.begin().await?;\n"
        "    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)\n"
        "        .await?;\n"
    )
    assert rewrite(src) == (
        "use medbrains_kernel as kernel;\n"
        "    let mut tx = kernel::scoped_tx(&state.db, &claims.tenant_id, "
        "&claims.department_ids).await?;\n"
    ), rewrite(src)
    src = "let mut tx = pool.begin().await?;\n medbrains_db::pool::set_audit_context(&mut tx, &t, &Uuid::nil(), None).await?;"
    assert rewrite(src).endswith("let mut tx = kernel::actor_tx(pool, &t, &Uuid::nil(), None).await?;")
    # A setter on a different transaction is not folded into the begin.
    src = "let mut tx = state.db.begin().await?;\nmedbrains_db::pool::set_tenant_context(&mut other, &t).await?;"
    assert "state.db.begin()" in rewrite(src) and "enter_tenant(&mut other" in rewrite(src)
    # Imports move only when every item exists in the kernel.
    assert rewrite(f"use {SC_AUTHZ}{{is_bypass_role, require_permission}};") == (
        "use medbrains_kernel::authz::{is_bypass_role, require_permission};"
    )
    kept = f"use {SC_AUTHZ}{{require_board_read, require_permission}};"
    assert rewrite(kept) == kept
    assert rewrite("medbrains_authz_gate::links::PRESCRIPTION") == (
        "use medbrains_health_services::patient as gate;\ngate::links::PRESCRIPTION"
    )
    tree = (
        "use medbrains_server_core::{\n    error::AppError, middleware::auth::Claims,"
        " middleware::authorization::require_permission,\n};\nfn f() { require_permission(c, P)?; }\n"
    )
    assert rewrite(tree) == (
        "use medbrains_server_core::{\n    error::AppError, middleware::auth::Claims,"
        " };\nuse medbrains_kernel::authz::require_permission;\nfn f() { require_permission(c, P)?; }\n"
    ), rewrite(tree)
    handler = (
        "async fn h(claims: Claims) -> R {\n"
        "    require_permission(&claims, permissions::x::VIEW)?;\n"
        "    let mut tx = state.db.begin().await?;\n"
        "    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;\n"
        "}\n"
    )
    out = rewrite(handler)
    assert "let permit = kernel::authz::permit(&claims, permissions::x::VIEW)?;" in out, out
    assert "kernel::tenant_tx(&state.db, &permit)" in out, out
    assert rewrite(out) == out
    # No decision before the opener: left on the tenant id, which will not compile.
    bare = "async fn h() {\n    let mut tx = pool.begin().await?;\n    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;\n}\n"
    assert "kernel::tenant_tx(pool, &tenant_id)" in rewrite(bare)
    assert rewrite(rewrite(src)) == rewrite(src)
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Rewrite one crate and print what is left for hand fixes."""
    if "--self-test" in sys.argv:
        return self_test()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        return 2
    crate = Path(args[0]).resolve()
    dry = "--dry" in sys.argv
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from check_kernel_boundary import SITE  # noqa: PLC0415 — the checker's own definition

    changed, sources = 0, []
    for path in sorted((crate / "src").rglob("*.rs")):
        old = path.read_text(encoding="utf-8")
        new = rewrite(old)
        sources.append(new)
        if new != old:
            changed += 1
            if not dry:
                path.write_text(new, encoding="utf-8")
        for line in split_tests(new)[0].splitlines():
            if SITE.search(line.split("//", 1)[0]):
                print(f"  left: {path.relative_to(crate)}: {line.strip()[:110]}")
    print(f"{changed} files rewritten{' (dry run)' if dry else ''}")
    if not dry:
        for note in fix_manifest(crate, sources):
            print(f"  {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
