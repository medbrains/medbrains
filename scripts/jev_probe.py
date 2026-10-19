#!/usr/bin/env python3
"""Run real MedBrains data through TypeSafe's Jev and score the answers.

Two probes:

  features  ground truth. Feature rows from MedBrains_Features.xlsx carry a
            Module label we wrote ourselves, so Jev's routing can be scored
            against it. Answers the question "can it route our vocabulary".

  enquiry   the product judgment. Real inbound enquiry text from the dev
            database, routed over the 32 real departments, plus an emergency
            and an actionable read. No ground truth — printed for review.

Needs TYPESAFE_API_KEY in the environment. Never commit the key.
"""

import collections
import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api.typesafe.ai/v1/systemone"
def _key():
    """Env first; else ~/.typesafe/key, so a run needs no key on the command line."""
    env = os.environ.get("TYPESAFE_API_KEY")
    if env:
        return env
    f = os.path.expanduser("~/.typesafe/key")
    return open(f).read().strip() if os.path.exists(f) else None


def _usable(key):
    """Catch a placeholder before it costs 60 identical failures."""
    if not key:
        return "no key: export TYPESAFE_API_KEY for this command, or put it in ~/.typesafe/key"
    if not key.isascii():
        return "that key has a non-ascii character in it — you have pasted a placeholder, not the key"
    if len(key) < 32 or not key.startswith("apikey_"):
        return "that does not look like a TypeSafe key (expected apikey_...)"
    return None


KEY = _key()
WORKERS = 6


def ask(state, questions):
    body = json.dumps({"model": "jev-latest", "state": state, "questions": questions}).encode()
    req = urllib.request.Request(
        API, data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:  # network, timeout
        return {"error": str(e)}


def psql(sql):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "medbrains",
         "-d", "medbrains", "-Atc", sql],
        cwd=os.path.join(os.path.dirname(__file__), "..", "medbrains"),
        capture_output=True, text=True, check=True,
    )
    return [l for l in out.stdout.splitlines() if l.strip()]


# --------------------------------------------------------------- features

def features(sample=60, seed=7):
    import openpyxl
    wb = openpyxl.load_workbook(
        os.path.join(os.path.dirname(__file__), "..", "MedBrains_Features.xlsx"), read_only=True)
    rows = [r for r in wb["Clinical"].iter_rows(values_only=True) if r[1] and r[3]][1:]
    modules = sorted({r[1] for r in rows})
    random.Random(seed).shuffle(rows)
    rows = rows[:sample]
    criteria = {m: None for m in modules}

    def one(r):
        a = ask(str(r[3]), {"module": {
            "type": "choice",
            "instructions": "A hospital management system tracks its features by module. "
                            "Which module of the system does this feature belong to?",
            "criteria": criteria,
        }})
        return r, a

    hits = 0
    conf_hit, conf_miss = [], []
    misses = []
    with ThreadPoolExecutor(WORKERS) as pool:
        for r, a in pool.map(one, rows):
            if "error" in a:
                print("  !", a["error"]); continue
            got = a["answers"]["module"]
            ok = got["choice"] == r[1]
            hits += ok
            (conf_hit if ok else conf_miss).append(got["confidence"])
            if not ok:
                misses.append((r[3][:64], r[1], got["choice"], got["confidence"]))
    n = len(conf_hit) + len(conf_miss)
    print(f"\nfeatures: {hits}/{n} agree with our own label ({hits / max(n, 1):.0%})")
    print(f"  confidence when it agreed:   {avg(conf_hit):.2f}")
    print(f"  confidence when it disagreed: {avg(conf_miss):.2f}")
    print("\n  disagreements:")
    for text, ours, theirs, c in misses:
        print(f"    {c:.2f}  ours={ours:<16} jev={theirs:<16} {text}")


def avg(xs):
    return sum(xs) / len(xs) if xs else 0.0


# --------------------------------------------------------------- enquiry

# Our enquiry corpus contains no emergency, so the emergency noul is only ever
# tested on negatives. These are written, not real, and are printed apart from
# the real rows so the two are never read as one result.
CONTROLS = [
    ("emergency", "My father is 68, his chest is tight and his left arm has gone numb, we are ten minutes away"),
    ("emergency", "wife is 36 weeks pregnant and bleeding, do we come to you or go somewhere else"),
    ("urgent-ish", "my son fell off his cycle an hour ago and his wrist is swollen, can someone look at it today"),
    ("routine", "I need my blood test report from last Tuesday emailed to me"),
    ("vague", "hello"),
]


def enquiry():
    departments = psql("select name from departments where deleted_at is null order by name")
    texts = psql(
        "select distinct coalesce(note, transcript) from mkt_interactions "
        "where coalesce(note, transcript) is not null and kind in ('message','form','call') "
        "union select distinct response_text from enquiry_logs where response_text is not null")
    criteria = {d: None for d in departments}
    criteria["Not a clinical enquiry"] = "Billing, visiting hours, directions, feedback, or anything a clerk answers without a doctor."

    questions = {
        "department": {
            "type": "choice",
            "instructions": "A hospital's public enquiry desk received this message. "
                            "Which department should answer it?",
            "criteria": criteria,
        },
        "emergency": {
            "type": "noul",
            "instructions": "Does this message describe someone who needs care now, rather than "
                            "an appointment or information?",
            "criteria": {"true": "Symptoms or an event that should not wait for a booking.",
                         "false": "A question, a booking request, or routine information."},
        },
        # Replaces an earlier "is this actionable" noul that answered 0.33-0.44 for
        # every message, clear ones included: it never said act *how*. The desk has
        # four next moves, so ask which one.
        "next_step": {
            "type": "choice",
            "instructions": "What should the desk do with this message next?",
            "criteria": {
                "answer_now": "The desk can answer it itself: hours, directions, what a department does.",
                "book_appointment": "They want to see someone; the desk should offer a slot.",
                "call_back": "Too vague to act on. Someone must ring them to find out what they need.",
                "escalate_clinical": "A clinician should see this before the desk replies.",
            },
        },
    }

    def one(t):
        return t, ask(t, questions)

    print(f"\nenquiry: {len(texts)} real messages over {len(departments)} real departments\n")
    with ThreadPoolExecutor(WORKERS) as pool:
        for t, a in pool.map(one, texts):
            if "error" in a:
                print("  !", a["error"], "|", t[:50]); continue
            show(t, a)

    print(f"\nsynthetic controls (written, not real data — emergency sensitivity only)\n")
    with ThreadPoolExecutor(WORKERS) as pool:
        for (label, t), a in zip(CONTROLS, pool.map(lambda c: ask(c[1], questions), CONTROLS)):
            if "error" in a:
                print("  !", a["error"]); continue
            show(t, a, label)


def show(t, a, label=None):
    d, e, n = a["answers"]["department"], a["answers"]["emergency"], a["answers"]["next_step"]
    print(f"  {(label + ': ' if label else '') + t[:70]}")
    print(f"      -> {d['choice']} ({d['confidence']:.2f})  emergency={e['noul']:.2f}  "
          f"next={n['choice']} ({n['confidence']:.2f})")


if __name__ == "__main__":
    problem = _usable(KEY)
    if problem:
        sys.exit(problem)
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    if which in ("features", "both"):
        features()
    if which in ("enquiry", "both"):
        enquiry()
