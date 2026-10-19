#!/usr/bin/env python3
"""Triage open GitHub issues with Jev: what is urgent, and what should be closed.

    python3 scripts/jev_triage.py fetch          # refresh the local issue cache
    python3 scripts/jev_triage.py pilot [N]      # judge a stratified sample, print cost
    python3 scripts/jev_triage.py all            # judge every open issue

Reads the key the same way as jev_probe.py: TYPESAFE_API_KEY, else ~/.typesafe/key.
Answers are cached per issue in the scratchpad so a rerun costs nothing.
"""

import json
import os
import random
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from jev_probe import KEY, _usable, ask  # noqa: E402

CACHE = os.environ.get("JEV_CACHE", "/tmp/claude-501/-Users-apple-Projects-MedBrains/"
                                    "e99e6416-a9f1-4050-9704-2f9e7292b2b0/scratchpad")
ISSUES = os.path.join(CACHE, "issues.json")
ANSWERS = os.path.join(CACHE, "triage.json")
WORKERS = 8

# Levels are hospital-concrete: an issue's rank has to mean something to a
# clinician or an auditor, not to a backlog groomer.
URGENCY = [
    "Cosmetic or speculative. Nothing is broken and nobody is waiting on it.",
    "Tech debt, refactoring or developer ergonomics. Work is harder without it but possible.",
    "A user cannot finish a task, or a screen shows wrong or missing data, but there is a way around it.",
    "Money, compliance or access control: billing or claims are wrong, patient data is reachable "
    "without the right permission, an audit trail is missing, or a legal or accreditation "
    "requirement is unmet.",
    "Patient safety now: a clinician could act on wrong clinical information, a safety check "
    "(allergy, dose, identity, controlled drug) can be bypassed, or care stops if this is not fixed.",
]

QUESTIONS = {
    "urgency": {"type": "score",
                "instructions": "How urgent is this issue for a hospital management system that is "
                                "already running in a live hospital?",
                "criteria": URGENCY},
    "disposition": {"type": "choice",
                    "instructions": "What should a maintainer do with this issue today?",
                    "criteria": {
                        "keep_open": "Real, still wanted, and specific enough that someone could pick it up.",
                        "already_described_as_done": "The text itself says the work is delivered, shipped or superseded.",
                        "too_vague_to_start": "Nobody could start without going back to the author for what it means. "
                                              "A requirement written from a template is still specific if its title names "
                                              "a concrete thing to build.",
                        "duplicate_or_superseded": "The same requirement is covered by other work, or a later decision "
                                                   "replaced it.",
                        "out_of_scope": "Not this system's job, or a decision that was made differently.",
                    }},
    "safety_claim": {"type": "noul",
                     "instructions": "Does this issue concern patient safety, controlled drugs, "
                                     "consent, or access to patient data?"},
}


def fetch():
    out = subprocess.run(
        ["gh", "issue", "list", "--state", "open", "--limit", "3000", "--json",
         "number,title,labels,body,createdAt,updatedAt,comments"],
        capture_output=True, text=True, check=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
    open(ISSUES, "w").write(out.stdout)
    print(f"cached {len(json.loads(out.stdout))} open issues")


def state_of(i):
    """Compact state: the title carries most of the meaning, the body is boilerplate."""
    age = (time.time() - time.mktime(time.strptime(i["createdAt"], "%Y-%m-%dT%H:%M:%SZ"))) / 86400
    body = " ".join((i.get("body") or "").split())[:500]
    return {
        "title": i["title"],
        "labels": [l["name"] for l in i.get("labels", [])],
        "opened_days_ago": round(age),
        "comments": i.get("comments", 0) if isinstance(i.get("comments"), int) else len(i.get("comments") or []),
        "body": body,
    }


def judge(issues):
    done = json.load(open(ANSWERS)) if os.path.exists(ANSWERS) else {}
    todo = [i for i in issues if str(i["number"]) not in done]
    print(f"{len(issues)} to triage, {len(issues) - len(todo)} already cached, asking about {len(todo)}")
    usage = [0, 0]
    started = time.time()

    def one(i):
        return i, ask(state_of(i), QUESTIONS)

    with ThreadPoolExecutor(WORKERS) as pool:
        for n, (i, a) in enumerate(pool.map(one, todo), 1):
            if "error" in a:
                print("  !", i["number"], a["error"]); continue
            done[str(i["number"])] = {"title": i["title"], "answers": a["answers"],
                                      "labels": [l["name"] for l in i.get("labels", [])]}
            usage[0] += a.get("usage", {}).get("input_tokens", 0)
            usage[1] += a.get("usage", {}).get("output_tokens", 0)
            if n % 25 == 0:
                json.dump(done, open(ANSWERS, "w"))
                print(f"  {n}/{len(todo)} …")
    json.dump(done, open(ANSWERS, "w"))
    if todo:
        print(f"\n{len(todo)} judged in {time.time() - started:.0f}s — "
              f"{usage[0]:,} input + {usage[1]:,} output tokens "
              f"({usage[0] / max(len(todo), 1):.0f} in/issue)")
    return done


def report(done, issues):
    rows = [(int(n), d) for n, d in done.items()]
    nums = {i["number"] for i in issues}
    rows = [(n, d) for n, d in rows if n in nums]

    def score(d):
        return d["answers"]["urgency"]["score"]

    epics = [(n, d) for n, d in rows if d["title"].lower().startswith("epic")]
    rows = [(n, d) for n, d in rows if not d["title"].lower().startswith("epic")]

    print("\n=== most urgent (epics excluded — they are containers, not work)")
    for n, d in sorted(rows, key=lambda r: -score(r[1]))[:20]:
        u = d["answers"]["urgency"]
        s = d["answers"]["safety_claim"]["noul"]
        lab = ",".join(l for l in d["labels"] if l.startswith("P")) or "-"
        print(f"  {score(d):4.2f} safety={s:.2f} label={lab:<12} #{n} {d['title'][:70]}")

    print("\n=== close candidates (disposition != keep_open, confidence >= 0.60)")
    close = [(n, d) for n, d in rows
             if d["answers"]["disposition"]["choice"] != "keep_open"
             and d["answers"]["disposition"]["confidence"] >= 0.60]
    by_reason = {}
    for n, d in close:
        by_reason.setdefault(d["answers"]["disposition"]["choice"], []).append((n, d))
    for reason, items in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
        print(f"\n  {reason}: {len(items)}")
        for n, d in sorted(items, key=lambda r: -r[1]["answers"]["disposition"]["confidence"])[:8]:
            print(f"    {d['answers']['disposition']['confidence']:.2f} #{n} {d['title'][:66]}")
    print(f"\n  {len(close)} of {len(rows)} judged closeable ({len(close) / max(len(rows), 1):.0%})")

    print(f"\n=== {len(epics)} epics, ranked apart")
    for n, d in sorted(epics, key=lambda r: -score(r[1]))[:6]:
        print(f"  {score(d):4.2f} #{n} {d['title'][:70]}")

    labelled = [(n, d) for n, d in rows if any(l.startswith("P") and "-" in l for l in d["labels"])]
    if labelled:
        print("\n=== against the P-labels we set ourselves")
        for tier in ("P0-critical", "P1-high", "P2-medium"):
            ours = [score(d) for _, d in labelled if tier in d["labels"]]
            if ours:
                print(f"  {tier:<12} n={len(ours):<4} mean jev urgency {sum(ours) / len(ours):.2f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "pilot"
    if cmd == "fetch":
        fetch(); sys.exit()
    problem = _usable(KEY)
    if problem:
        sys.exit(problem)
    issues = json.load(open(ISSUES))
    if cmd == "pilot":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        issues.sort(key=lambda i: i["createdAt"])
        third = n // 3
        pick = issues[:third] + issues[-third:] + random.Random(11).sample(issues, n - 2 * third)
        issues = list({i["number"]: i for i in pick}.values())
    report(judge(issues), issues)
