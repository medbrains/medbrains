#!/usr/bin/env python3
"""Every LLM call goes through redaction (medbrains_core::ai_redact).

    python3 scripts/check_llm_redaction.py

The type system does most of it: the LLM entry points take `Redacted`, and
the only ways to make one are `Redactor::redact` and `Redacted::fixed` (a
source literal). This check closes the gaps types cannot:

  1. Only the gateway files may talk to a model provider at all
     (`rig::providers`, a raw `/chat/completions` POST, the Anthropic or
     Bedrock endpoints).
  2. In those files, every text handed to the model — `.preamble(`,
     `.extract(`, `.stream_prompt(`, `.prompt(`, a chat `"content":` — is read
     through `.for_model()`, i.e. it is a `Redacted`.
  3. `Redacted::fixed(...)` takes a string literal or an UPPER_CASE constant,
     never a runtime value.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GATEWAYS = {
    "crates/medbrains-ai/src/lib.rs",
    "crates/medbrains-server-services/src/llm.rs",
    "crates/medbrains-server/src/services/simulator/decision.rs",
    "crates/medbrains-ai-eval/src/live.rs",
}
PROVIDER = re.compile(r"rig::providers|/chat/completions|api\.anthropic\.com|bedrock-runtime")
MODEL_INPUT = re.compile(r"\.(preamble|extract|stream_prompt|prompt)\(|\"content\":")
FIXED = re.compile(r"Redacted::fixed\(\s*([^)]*)\)")


def call_args(text: str, start: int) -> str:
    """The text from `start` up to the matching close of the call (or line)."""
    depth, i = 0, start
    while i < len(text):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth <= 0:
                return text[start : i + 1]
        elif c in ",}\n" and depth == 0:
            return text[start:i]
        i += 1
    return text[start:]


def main() -> int:
    problems: list[str] = []
    for path in sorted((ROOT / "crates").glob("*/src/**/*.rs")):
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        if rel not in GATEWAYS:
            for m in PROVIDER.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                problems.append(f"{rel}:{line}: talks to a model outside the redaction gateway")
        else:
            for m in MODEL_INPUT.finditer(text):
                args = call_args(text, m.end() - (0 if m.group(0).endswith(":") else 1))
                if "for_model()" not in args:
                    line = text.count("\n", 0, m.start()) + 1
                    problems.append(f"{rel}:{line}: model input not read through .for_model()")
        for m in FIXED.finditer(text):
            arg = m.group(1).strip()
            if not (arg.startswith('"') or re.fullmatch(r"[A-Z][A-Z0-9_]*", arg)):
                line = text.count("\n", 0, m.start()) + 1
                problems.append(f"{rel}:{line}: Redacted::fixed takes a literal or a CONST, got {arg!r}")
    if problems:
        print("LLM calls bypassing redaction:")
        for p in problems:
            print(f"  {p}")
        return 1
    print("✓ every LLM call goes through redaction")
    return 0


if __name__ == "__main__":
    sys.exit(main())
