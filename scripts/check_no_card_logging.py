#!/usr/bin/env python3
"""
PCI DSS scope reduction check — bans payment card identifiers from log
statements in Rust + TypeScript source.

We do not store/process raw PAN, CVV, or card track data — Razorpay
tokenizes payments. This script ensures no developer accidentally logs
a card-related field name in `tracing::info!`, `tracing::error!`,
`println!`, `console.log`, etc., which would pull PCI scope back in.

Heuristic: lint for forbidden field names appearing in the same line as
a log/print macro. False positives go through `// allow-card-log: <reason>`.

Exit codes:
    0  No card-related identifiers in logs
    1  One or more violations
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Surfaces to scan
SCAN_DIRS = [
    REPO_ROOT / "medbrains" / "crates",
    REPO_ROOT / "medbrains" / "apps" / "web" / "src",
    REPO_ROOT / "medbrains" / "packages",
]

# Forbidden tokens. Conservative — words that should never appear in a
# log line for compliance reasons, regardless of casing.
FORBIDDEN = re.compile(
    r"\b(pan_number|card_number|cardnumber|cvv|cvc|cvv2|"
    r"track_data|track1|track2|magstripe|pin_block|"
    r"primary_account_number)\b",
    re.IGNORECASE,
)

# Log-emitting call patterns (Rust + TS)
LOG_LINE = re.compile(
    r"(tracing::(info|warn|error|debug|trace)|"
    r"println!|eprintln!|print!|eprint!|"
    r"console\.(log|info|warn|error|debug)|"
    r"log\.(info|warn|error|debug))"
)

ALLOW = re.compile(r"//\s*allow-card-log\b|#\s*allow-card-log\b")


def main() -> int:
    violations: list[tuple[Path, int, str]] = []
    suppressed = 0

    for root in SCAN_DIRS:
        if not root.exists():
            continue
        for ext in ("*.rs", "*.ts", "*.tsx"):
            for f in root.rglob(ext):
                # Skip obvious build artifacts
                if any(p in f.parts for p in ("target", "node_modules", "dist", "lib")):
                    continue
                try:
                    text = f.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    continue
                for lineno, line in enumerate(text.splitlines(), 1):
                    if not LOG_LINE.search(line):
                        continue
                    if not FORBIDDEN.search(line):
                        continue
                    if ALLOW.search(line):
                        suppressed += 1
                    else:
                        violations.append((f, lineno, line.strip()))

    if violations:
        print(f"=== {len(violations)} CARD-LOGGING VIOLATIONS ===")
        for f, n, line in violations:
            print(f"  ✗ {f.relative_to(REPO_ROOT)}:{n}: {line[:160]}")
        print()
        print("Card identifiers MUST NOT appear in log lines (PCI scope).")
        print("Tokenize via Razorpay or hash before logging.")
        print("Escape: `// allow-card-log: <reason>` (reviewed).")
        return 1

    print(
        f"✓ No card-related fields in log statements. ({suppressed} explicit suppressions.)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
