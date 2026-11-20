#!/usr/bin/env python3
"""Readiness meters, measured from medbrains/docs/readiness.json.

Each meter is a weighted checklist: done counts in full, partial counts half,
not-started counts nothing. An item counts only with evidence: a PR squash-merged
on main, a file that exists, or a named test in a file. This writes the
shields.io endpoint badges (.github/badges/readiness-<id>.json), the README badge
row and the README tables between the readiness and regulation markers, so no
percentage is ever typed by hand. A meter with "assessed": false shows "not
assessed" in grey and no percentage; "accent": true colours a measured badge
purple, not blue; a meter with "group": "regulation" goes in the regulation table;
a meter with `live` adds a measured line (LIVE below) to its summary.

    python3 scripts/readiness.py            # regenerate badges + README table
    python3 scripts/readiness.py --check    # CI: fail on missing evidence or stale files
    python3 scripts/readiness.py --self-test

--check needs the full history (fetch-depth: 0) to find merged PRs.
"""

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "medbrains/docs/readiness.json"
BADGES = ROOT / ".github/badges"
README = ROOT / "README.md"
COUNTRIES = ROOT / "data/geo/countries.json"
WORLD_LITERALS = ROOT / "medbrains/scripts/check_world_literals.py"
GROUPS = {None: "readiness", "regulation": "regulation"}  # meter group -> README marker name
COLOR = {"measured": "0F62FE", "accent": "851B7F", "unassessed": "5D677A"}
BADGE_START, BADGE_END = "<!-- readiness-badges:start -->", "<!-- readiness-badges:end -->"
BADGE_URL = "https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-{}.json"
CREDIT = {"done": 1.0, "partial": 0.5, "not-started": 0.0}
LABEL = {"done": "Done", "partial": "Partial", "not-started": "Not started"}


def percent(meter):
    """Weighted share of a meter's items that are done (partial counts half), 0-100.

    Halves round up, as Math.round does on the website, not to even as round() does.
    """
    total = sum(i["weight"] for i in meter["items"])
    got = sum(i["weight"] * CREDIT[i["status"]] for i in meter["items"])
    return int(100 * got / total + 0.5) if total else 0


def is_assessed(meter):
    """Whether the meter has been assessed against evidence; an unassessed one shows no number."""
    return meter.get("assessed", True)


def shown(meter):
    """The meter's reading as text: its percentage, or "not assessed"."""
    return f"{percent(meter)}%" if is_assessed(meter) else "not assessed"


def merged_prs():
    """PR numbers squash-merged into HEAD's history, read from commit subjects."""
    log = subprocess.run(["git", "log", "--format=%s", "HEAD"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    return {int(n) for n in re.findall(r"\(#(\d+)\)\s*$", log, re.MULTILINE)}


def evidence_errors(data, merged, root=ROOT):
    """Every reason an item's status is not backed by evidence, as readable lines."""
    errors = []
    for meter in data["meters"]:
        if meter.get("live") and meter["live"] not in LIVE:
            errors.append(f"{meter['id']}: unknown live line {meter['live']!r}")
        for item in meter["items"]:
            where = f"{meter['id']}/{item['id']}"
            status = item.get("status")
            if status not in CREDIT:
                errors.append(f"{where}: unknown status {status!r}")
                continue
            if not item.get("title"):
                errors.append(f"{where}: no title")
            if not isinstance(item.get("weight"), int) or item["weight"] < 1:
                errors.append(f"{where}: weight must be a positive integer")
            evidence = item.get("evidence", [])
            if status != "not-started" and not evidence:
                errors.append(f"{where}: {status} without evidence")
            errors += [f"{where}: {e}" for e in (check_one(ev, merged, root) for ev in evidence) if e]
    return errors


def check_one(ev, merged, root):
    """Why one piece of evidence does not hold, or None when it does."""
    if "pr" in ev:
        return None if ev["pr"] in merged else f"PR #{ev['pr']} is not merged on main"
    path = root / ev.get("path", "")
    if not ev.get("path") or not path.is_file():
        return f"evidence file {ev.get('path')!r} does not exist"
    if "test" in ev and ev["test"] not in path.read_text(encoding="utf-8"):
        return f"test {ev['test']!r} not found in {ev['path']}"
    return None


def world_literals_text(live, baseline):
    """The ratchet line for the world meter from (lines, files) now and in the baseline."""
    return (f"India literals outside the India pack: {live[0]:,} lines in {live[1]:,} files "
            f"(baseline {baseline[0]:,} in {baseline[1]:,}; it may only go down, "
            "`make check-world-literals`).")


def world_literals():
    """Measures the #5935 ratchet now and reads its committed baseline."""
    spec = importlib.util.spec_from_file_location("check_world_literals", WORLD_LITERALS)
    check = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(check)
    baseline = json.loads(check.BASELINE.read_text(encoding="utf-8"))
    return world_literals_text(check.totals(check.measure()), check.totals(baseline))


def countries_text(countries):
    """How many countries have research, from the country list's `research` fields."""
    done = sum(1 for c in countries if c.get("research"))
    return (f"{done} of {len(countries)} countries researched (research only, not built; "
            "counted from `data/geo/countries.json`), never counted in the percentage.")


def countries_researched():
    """The research line for the country-pack meter, from the committed country list."""
    return countries_text(json.loads(COUNTRIES.read_text(encoding="utf-8")))


LIVE = {"world-literals": world_literals, "countries-researched": countries_researched}


def badge(meter):
    """The shields.io endpoint JSON for one meter."""
    color = COLOR["accent" if meter.get("accent") else "measured"]
    return json.dumps({"schemaVersion": 1, "label": meter["title"], "message": shown(meter),
                       "color": color if is_assessed(meter) else COLOR["unassessed"]}, indent=2) + "\n"


def evidence_text(item):
    """Evidence and tracking for one item as short markdown."""
    parts = [f"#{e['pr']}" if "pr" in e else f"`{e['path']}`" for e in item.get("evidence", [])]
    if item.get("tracking"):
        parts.append(f"open: {item['tracking']}")
    return ", ".join(parts) or "-"


def table(meters, live):
    """One README section: a summary row per meter, the measured `live` lines, and the
    item list of each assessed meter. `live` maps a meter's `live` key to its line."""
    lines = ["| Meter | Measured | Done | Partial | Not started |", "|---|---|---|---|---|"]
    for m in meters:
        n = {s: sum(i["status"] == s for i in m["items"]) for s in CREDIT}
        if is_assessed(m):
            lines.append(f"| {m['title']} | **{shown(m)}** | {n['done']} | {n['partial']} | {n['not-started']} |")
        else:
            lines.append(f"| {m['title']} | {shown(m)} | - | - | - |")
    notes = [f"- {m['title']}: {live[m['live']]}" for m in meters if m.get("live")]
    lines += ["", *notes] if notes else []
    for m in filter(is_assessed, meters):
        lines += ["", f"<details><summary>{m['title']}: {shown(m)}</summary>", ""]
        if m.get("live"):
            lines += [f"{m['summary']} {live[m['live']]}", ""]
        lines += ["| Item | Weight | State | Evidence |", "|---|---|---|---|"]
        lines += [f"| {i['title']} | {i['weight']} | {LABEL[i['status']]} | {evidence_text(i)} |"
                  for i in m["items"]]
        lines += ["", "</details>"]
    return "\n".join(lines)


def badge_row(data):
    """The README badge row: one shields.io endpoint badge per readiness meter (regulation ones are listed by hand)."""
    return "\n".join(f"[![{m['title']}]({BADGE_URL.format(m['id'])})](#readiness)"
                     for m in data["meters"] if m.get("group") is None)


def between(text, start, end, body):
    """`text` with everything between the two markers replaced by `body`."""
    head, sep, rest = text.partition(start)
    if not sep or end not in rest:
        raise SystemExit(f"README.md has no {start} ... {end} markers")
    return f"{head}{start}\n{body}\n{end}{rest.partition(end)[2]}"


def outputs(data, readme_text, live=None):
    """Every generated file and its expected content, keyed by path."""
    files = {BADGES / f"readiness-{m['id']}.json": badge(m) for m in data["meters"]}
    live = live if live is not None else {k: f() for k, f in LIVE.items()}
    readme_text = between(readme_text, BADGE_START, BADGE_END, badge_row(data))
    for group, name in GROUPS.items():
        meters = [m for m in data["meters"] if m.get("group") == group]
        readme_text = between(readme_text, f"<!-- {name}:start -->", f"<!-- {name}:end -->",
                              table(meters, live))
    files[README] = readme_text
    return files


def self_test():
    """Checks the arithmetic, the evidence rules and the table on a fixture."""
    meter = {"id": "t", "title": "T", "items": [
        {"id": "a", "title": "A", "weight": 2, "status": "done", "evidence": [{"pr": 1}]},
        {"id": "b", "title": "B", "weight": 2, "status": "partial", "evidence": [{"path": "scripts/readiness.py"}]},
        {"id": "c", "title": "C", "weight": 4, "status": "not-started"}]}
    assert percent(meter) == 38, percent(meter)  # (2 + 1) / 8 = 37.5, half rounds up
    # 12.5 must read 13, as on the website; round() would say 12.
    assert percent({"items": [{"weight": 1, "status": "partial"}, {"weight": 3, "status": "not-started"}]}) == 13
    data = {"meters": [meter]}
    assert evidence_errors(data, {1}) == []
    assert evidence_errors(data, set()) == ["t/a: PR #1 is not merged on main"]
    meter["items"][2]["status"] = "done"
    assert evidence_errors(data, {1}) == ["t/c: done without evidence"]
    meter["items"][1]["evidence"] = [{"test": "a test name", "path": "LICENSE"}]
    assert "not found" in evidence_errors(data, {1})[0]
    meter["items"][1]["evidence"] = [{"path": "nope/missing.txt"}]
    assert "does not exist" in evidence_errors(data, {1})[0]
    assert "| T | **88%** | 2 | 1 | 0 |" in table(data["meters"], {})
    assert '"message": "88%"' in badge(meter) and '"0F62FE"' in badge(meter)
    assert '"851B7F"' in badge({**meter, "accent": True})
    # Not assessed: grey even when accented, no number, no item list; evidence rules still hold.
    blank = {"id": "u", "title": "U", "assessed": False, "items": []}
    assert '"message": "not assessed"' in badge(blank) and '"5D677A"' in badge(blank)
    assert '"5D677A"' in badge({**blank, "accent": True})
    assert "| U | not assessed | - | - | - |" in table([blank], {})
    assert "<details>" not in table([blank], {})
    assert evidence_errors({"meters": [blank]}, set()) == []
    readme = ("<!-- readiness-badges:start --><!-- readiness-badges:end --> "
              "a <!-- readiness:start -->x<!-- readiness:end --> b <!-- regulation:start -->y<!-- regulation:end -->")
    out = outputs({"meters": [meter, {**blank, "group": "regulation"}]}, readme, {})[README]
    assert out.index("| T |") < out.index("regulation:start") < out.index("| U |")
    # A meter's live line shows under its table and in its summary.
    lived = dict(meter, live="countries-researched", summary="S.")
    shown_live = table([lived], {"countries-researched": "2 of 3."})
    assert "- T: 2 of 3." in shown_live and "S. 2 of 3." in shown_live
    assert evidence_errors({"meters": [dict(meter, live="nope")]}, {1})[0].endswith("unknown live line 'nope'")
    countries = [{"code": "IN", "research": 5696}, {"code": "AE", "research": 5426}, {"code": "FR"}]
    assert countries_text(countries).startswith("2 of 3 countries researched (research only, not built")
    line = world_literals_text((3400, 980), (3492, 986))
    assert "3,400 lines in 980 files (baseline 3,492 in 986;" in line, line
    assert "[![T](" in badge_row(data) and "readiness-t.json" in badge_row(data)
    assert "readiness-u.json" not in badge_row({"meters": [{**blank, "group": "regulation"}]})
    real = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert all(0 <= percent(m) <= 100 for m in real["meters"])
    print("readiness self-test: ok")


def main():
    """Regenerates the outputs, or with --check refuses bad evidence and stale files."""
    if "--self-test" in sys.argv:
        return self_test()
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    errors = evidence_errors(data, merged_prs())
    files = outputs(data, README.read_text(encoding="utf-8"))
    if "--check" in sys.argv:
        errors += [f"{p.relative_to(ROOT)} is stale: run python3 scripts/readiness.py"
                   for p, body in files.items() if not p.is_file() or p.read_text(encoding="utf-8") != body]
        for e in errors:
            print(f"readiness: {e}", file=sys.stderr)
        sys.exit(1 if errors else 0)
    if errors:
        sys.exit("readiness:\n  " + "\n  ".join(errors))
    BADGES.mkdir(parents=True, exist_ok=True)
    for path, body in files.items():
        path.write_text(body, encoding="utf-8")
    for m in data["meters"]:
        print(f"{m['title']}: {shown(m)}")


if __name__ == "__main__":
    main()
