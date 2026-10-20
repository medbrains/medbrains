#!/usr/bin/env python3
"""Every screen that shows AI output shows the AiLabel with it (#4895).

    python3 scripts/check_ai_label.py

AI scribes in the field drafted wrong text often enough (11.5% in one pilot)
that unlabelled AI output is a patient-safety defect: a reader cannot weigh
what they cannot tell apart. So a .tsx file that reads an AI source must carry
`AiLabel` itself — the label lives where the output is drawn, not "somewhere
up the tree", because that is the only thing a static check can hold.

AI sources, found rather than listed so a new endpoint is covered on arrival:
  - `api.<method>` for every client method whose path is an AI endpoint
    (`/ai/…`, or a segment starting `ai-`),
  - any service function in apps/web/src/services that wraps one,
  - the assistant's own pieces: `useAiChat`, `UnifiedResponse`, `draftOffer`.

A file that genuinely needs no label (it only mounts a labelled panel, or the
endpoint is a stub that returns no AI content) says why on the line:
    // ai-label-exempt: <reason>
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = os.path.join(ROOT, "packages/api/src/client.ts")
WEB = os.path.join(ROOT, "apps/web/src")
SERVICES = os.path.join(WEB, "services")

AI_PATH = re.compile(r"/ai/|/ai-[a-z]")
# On an AI path but not AI output: the settings screen configures the model,
# and whispers are rule-fired critical results (lab_critical_alerts rows).
NOT_AI_OUTPUT = {"getAiSettings", "updateAiSettings", "whisperStream"}
METHOD = re.compile(r"^  (\w+): ")
ASSISTANT_PIECES = ("useAiChat", "UnifiedResponse", "draftOffer")
EXEMPT = re.compile(r"ai-label-exempt:\s*\S")
# How far below a method's name its request path may sit.
METHOD_SPAN = 25


def ai_api_methods() -> set[str]:
    methods: set[str] = set()
    current, since = None, 0
    with open(CLIENT, encoding="utf-8") as fh:
        for line in fh:
            match = METHOD.match(line)
            if match:
                current, since = match.group(1), 0
            since += 1
            if current and since <= METHOD_SPAN and AI_PATH.search(line):
                methods.add(current)
    return methods - NOT_AI_OUTPUT


def ai_service_functions(methods: set[str]) -> set[str]:
    wrapped = re.compile(r"api\.(" + "|".join(sorted(methods)) + r")\b")
    names: set[str] = set()
    for dirpath, _dirs, files in os.walk(SERVICES):
        for name in files:
            if not name.endswith(".ts"):
                continue
            with open(os.path.join(dirpath, name), encoding="utf-8") as fh:
                for line in fh:
                    fn = re.match(r"\s+(\w+):", line)
                    if fn and wrapped.search(line):
                        names.add(fn.group(1))
    return names


def offenders() -> list[tuple[str, str]]:
    methods = ai_api_methods()
    services = ai_service_functions(methods)
    source = re.compile(
        r"\bapi\.(" + "|".join(sorted(methods)) + r")\b"
        r"|\.(" + "|".join(sorted(services) or ["$^"]) + r")\("
        r"|\b(" + "|".join(ASSISTANT_PIECES) + r")\b"
    )
    found: list[tuple[str, str]] = []
    for dirpath, _dirs, files in os.walk(WEB):
        for name in files:
            if not name.endswith(".tsx") or ".test." in name or ".stories." in name:
                continue
            path = os.path.join(dirpath, name)
            text = open(path, encoding="utf-8").read()
            hit = source.search(text)
            if not hit or "AiLabel" in text or EXEMPT.search(text):
                continue
            found.append((os.path.relpath(path, ROOT), hit.group(0)))
    return found


def main() -> int:
    found = offenders()
    if not found:
        print("✓ every screen that reads AI output carries the AiLabel")
        return 0
    print(f"{len(found)} file(s) show AI output without an AiLabel:\n")
    for rel, source in found:
        print(f"   {rel}  (reads {source})")
    print(
        "\nRender <AiLabel /> from @/components/ui beside the AI output, or, if the\n"
        "file shows none, say why: // ai-label-exempt: <reason>"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
