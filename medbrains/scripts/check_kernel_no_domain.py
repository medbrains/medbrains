#!/usr/bin/env python3
"""The kernel stays technical: no domain crates below it, no domain words in it.

    python3 scripts/check_kernel_no_domain.py              # check (CI)
    python3 scripts/check_kernel_no_domain.py --self-test

RFC-HOSPITAL-OS §3a. Mechanism in the kernel, policy and domain above it. Two
rules, and both are about `crates/medbrains-kernel`:

1. Everything the kernel runs on (its runtime `medbrains-*` dependencies, all the
   way down) is in TECHNICAL. An allowlist, because the workspace has ~150 crates
   and a denylist of clinical names would miss the next one.
2. Its source says nothing about hospitals. The whole non-test source is scanned,
   comments included, which covers the public API and leaves no private helper
   for a domain concept to hide in. String contents are data (SQL, a scope name
   the screen shows) and are not scanned. Identifiers are split into words, so
   `require_patient_access` and `PatientRef` match and `Claims` does not.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from check_kernel_boundary import runtime_deps

CRATES = Path(__file__).resolve().parent.parent / "crates"
KERNEL = "medbrains-kernel"

# ponytail: "not a clinical module", not "free of domain words". core holds domain
# types the kernel does not use (`medbrains_core::billing`, say); server-core, which
# gives it `AppError` and `Claims`, print, workflow and db know about patients in
# places. Splitting the technical part out is its own phase (RFC §3a, known limit).
TECHNICAL = frozenset({
    "medbrains-adapter-sdk",
    "medbrains-api-keys",
    "medbrains-authz",
    "medbrains-core",
    "medbrains-crypto",
    "medbrains-db",
    "medbrains-db-topology",
    "medbrains-outbox",
    "medbrains-print",
    "medbrains-server-core",
    "medbrains-spicedb-proto",
    "medbrains-workflow",
})

DOMAIN_WORDS = frozenset({
    "abha", "admission", "billing", "bill", "blood", "clinical", "clinician", "consent",
    "diagnosis", "discharge", "doctor", "drug", "encounter", "hospital", "insurance",
    "invoice", "ipd", "laboratory", "medication", "mrn", "nurse", "opd", "patient",
    "pharmacy", "prescription", "radiology", "surgery", "tpa", "uhid", "ward",
})

COMMENT_OR_STRING = re.compile(r'//[^\n]*|"(?:[^"\\]|\\.)*"', re.DOTALL)


def closure(start: str, read_deps) -> dict[str, str]:
    """Each `medbrains-*` crate `start` runs on, mapped to the crate that pulled it in."""
    seen, stack = {}, [start]
    while stack:
        parent = stack.pop()
        for dep in sorted(read_deps(parent)):
            if dep.startswith("medbrains-") and dep not in seen:
                seen[dep] = parent
                stack.append(dep)
    return seen


def manifest_deps(crate: str) -> set[str]:
    """Runtime dependencies of a workspace crate; none if it is not one."""
    manifest = CRATES / crate / "Cargo.toml"
    return runtime_deps(manifest.read_text(encoding="utf-8")) if manifest.exists() else set()


def domain_crates(deps: dict[str, str]) -> list[str]:
    """A failure line for each dependency outside the technical allowlist."""
    return [f"{dep} (via {parent})" for dep, parent in sorted(deps.items()) if dep not in TECHNICAL]


def domain_words(source: str) -> list[tuple[int, str]]:
    """`(line, word)` for each domain word in Rust source, before its test module."""
    # clippy::items_after_test_module (denied) keeps the test module last.
    code = source.split("#[cfg(test)]", 1)[0].replace("RFC-HOSPITAL-OS", "the RFC")
    code = COMMENT_OR_STRING.sub(
        lambda m: m[0] if m[0].startswith("//") else '"' + "\n" * m[0].count("\n") + '"', code
    )
    found = []
    for number, line in enumerate(code.splitlines(), 1):
        split = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", line)
        for word in re.findall(r"[A-Za-z]+", split):
            word = word.lower()
            root = word.removesuffix("s")
            if word in DOMAIN_WORDS or root in DOMAIN_WORDS:
                found.append((number, root if root in DOMAIN_WORDS else word))
    return found


def self_test() -> int:
    """Prove each rule fails on the violation it exists for, and only that."""
    assert domain_words("pub fn require_patient_access() {}") == [(1, "patient")]
    assert domain_words("pub enum Ref { PatientId }") == [(1, "patient")]
    assert domain_words("pub struct A { pub uhids: u8 }") == [(1, "uhid")]
    assert domain_words("/// Bills go here.\nfn a() {}") == [(1, "bill")]
    assert domain_words("fn private_consent_helper() {}") == [(1, "consent")]
    assert domain_words('pub use medbrains_authz_gate::require_patient_access;') == [(1, "patient")]
    assert not domain_words("//! See RFC-HOSPITAL-OS §3.")
    assert not domain_words('pub const SCOPES: [&str; 1] = ["hospital"];')
    assert not domain_words('fn a() { q("SELECT * FROM patients \\\n WHERE x"); }')
    assert not domain_words("pub use auth::Claims;\npub struct Resource;\nfn wardrobe() {}")
    assert not domain_words('fn a() {}\n#[cfg(test)]\nmod tests { const P: &str = "x"; fn patient() {} }')
    # A string on an earlier line must not eat the code after it, or shift the line.
    assert domain_words('const A: &str = "a\nb";\nfn patient() {}') == [(3, "patient")]

    graph = {
        KERNEL: {"medbrains-db", "serde"},
        "medbrains-db": {"medbrains-billing", "medbrains-core"},
        "medbrains-billing": {KERNEL},
    }
    deps = closure(KERNEL, lambda c: graph.get(c, set()))
    assert "serde" not in deps
    assert domain_crates(deps) == [
        "medbrains-billing (via medbrains-db)",
        f"{KERNEL} (via medbrains-billing)",
    ]
    assert not domain_crates({"medbrains-db": KERNEL, "medbrains-core": "medbrains-db"})
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check the kernel's dependencies and source; 1 on any domain leak."""
    if "--self-test" in sys.argv:
        return self_test()
    crates = domain_crates(closure(KERNEL, manifest_deps))
    words = [
        f"{path.relative_to(CRATES)}:{line}: {word}"
        for path in sorted((CRATES / KERNEL / "src").rglob("*.rs"))
        for line, word in domain_words(path.read_text(encoding="utf-8"))
    ]
    if crates or words:
        print("✗ the kernel is technical only (RFC-HOSPITAL-OS §3a); move this up to health services:")
        for leak in crates + words:
            print(f"  {leak}")
        return 1
    print("✓ kernel has no domain crates and no domain words")
    return 0


if __name__ == "__main__":
    sys.exit(main())
