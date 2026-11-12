#!/usr/bin/env python3
"""Supply-chain gate: locked builds, a review for every new package, a cooldown on new versions.

Lesson from xz (2024): a trusted contributor hid a backdoor in a dependency, and it was caught
weeks after release. Most poisoned packages are found and pulled within days, so we let a new
version age before taking it, and a person reads every package we have never used before.

  python3 scripts/check_supply_chain.py --self-test
  python3 scripts/check_supply_chain.py workflows        # every build uses its lockfile
  python3 scripts/check_supply_chain.py deps origin/main # new packages reviewed, new versions >= 7 days

`deps` reads every Cargo.lock, pnpm-lock.yaml, uv.lock and gradle.lockfile in the repo and compares
them with the base ref:
  * a package name never seen before in that ecosystem needs a [[review]] in REVIEWS;
  * a version never seen before must be COOLDOWN_DAYS old on its registry, or have a
    [[cooldown-exception]] with a reason (a security fix that cannot wait).
A registry that cannot be reached fails the check: unverified is not verified.
"""

from __future__ import annotations

import functools
import json
import re
import subprocess
import sys
import time
import tomllib
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REVIEWS = "medbrains/supply-chain/new-dependencies.toml"
COOLDOWN_DAYS = 7
LOCKFILE = re.compile(r"(^|/)(Cargo\.lock|pnpm-lock\.yaml|uv\.lock|gradle\.lockfile)$")
USER_AGENT = "medbrains-supply-chain-check (https://github.com/medbrains/medbrains)"
MAVEN_REPOS = (
    "https://repo1.maven.org/maven2",
    "https://dl.google.com/dl/android/maven2",
    "https://plugins.gradle.org/m2",
)

# (ecosystem, name, version, published-or-None); None means "ask the registry".
Package = tuple[str, str, str, str | None]


def parse_cargo(text: str) -> list[Package]:
    """Registry and git packages from a Cargo.lock; workspace members have no source."""
    return [
        ("cargo", p["name"], p["version"], None)
        for p in tomllib.loads(text).get("package", [])
        if "source" in p
    ]


def parse_uv(text: str) -> list[Package]:
    """Registry packages from a uv.lock, with the upload time uv already recorded."""
    out = []
    for p in tomllib.loads(text).get("package", []):
        if "registry" not in p.get("source", {}):
            continue
        files = [p["sdist"]] if "sdist" in p else []
        times = sorted(f["upload-time"] for f in files + p.get("wheels", []) if "upload-time" in f)
        out.append(("pypi", p["name"].lower().replace("_", "-"), p["version"], times[0] if times else None))
    return out


PNPM_KEY = re.compile(r"^  '?((?:@[^@/'\s]+/)?[^@'\s]+)@(\d[^('\s:]*)'?:\s*$")


def parse_pnpm(text: str) -> list[Package]:
    """Registry packages from the `packages:` section of a pnpm v9 lockfile.

    Raises ValueError on a missing section or on any key that is not `name@version`: a git,
    tarball or file dependency must never slip past the review and the cooldown unparsed."""
    if "\npackages:\n" not in text:
        if "\nimporters:\n" in text or "\ndependencies:\n" in text:
            raise ValueError("pnpm lockfile has dependencies but no `packages:` section")
        return []
    section = text.split("\npackages:\n", 1)[1].split("\nsnapshots:\n", 1)[0]
    keys = [line for line in section.splitlines() if line.startswith("  ") and not line.startswith("   ")]
    bad = [k.strip() for k in keys if not PNPM_KEY.match(k)]
    if bad:
        raise ValueError(f"pnpm keys this check cannot read (git, tarball or file sources?): {', '.join(bad[:5])}")
    return [("npm", m[1], m[2], None) for m in map(PNPM_KEY.match, keys) if m]


def parse_gradle(text: str) -> list[Package]:
    """Maven coordinates from a Gradle dependency lockfile."""
    out = []
    for line in text.splitlines():
        coord = line.split("=", 1)[0]
        if line.startswith("#") or coord == "empty" or coord.count(":") != 2:
            continue
        group, artifact, version = coord.split(":")
        out.append(("maven", f"{group}:{artifact}", version, None))
    return out


PARSERS = {"Cargo.lock": parse_cargo, "uv.lock": parse_uv, "pnpm-lock.yaml": parse_pnpm, "gradle.lockfile": parse_gradle}


def git(*args: str) -> str:
    """Runs git in the repo and returns stdout; a failure stops the check."""
    return subprocess.run(["git", *args], cwd=REPO, check=True, capture_output=True, text=True).stdout


def packages_at(ref: str | None) -> list[Package]:
    """Every package in every tracked lockfile, at a ref or in the working tree."""
    names = git("ls-tree", "-r", "--name-only", ref) if ref else git("ls-files")
    out: list[Package] = []
    for path in filter(LOCKFILE.search, names.splitlines()):
        if "/vendor/" in path or "node_modules/" in path:
            continue
        text = git("show", f"{ref}:{path}") if ref else (REPO / path).read_text(encoding="utf-8")
        try:
            out += PARSERS[Path(path).name](text)
        except ValueError as err:
            raise ValueError(f"{path} at {ref or 'working tree'}: {err}") from err
    return out


# A cooldown exception must name the advisory it is for; free text is not a reason.
ADVISORY = re.compile(
    r"\b(RUSTSEC-\d{4}-\d{4}|GHSA(-[23456789cfghjmpqrvwx]{4}){3}|CVE-\d{4}-\d{4,}|PYSEC-\d{4}-\d+|GO-\d{4}-\d+)\b"
)


def load_reviews(text: str) -> tuple[set[tuple[str, str]], dict[tuple[str, str, str], str]]:
    """Reads the reviewed names and the cooldown exceptions; an exception counts only with an advisory id.

    The file is code-owned (.github/CODEOWNERS), so the owner's review of each entry is the gate."""
    data = tomllib.loads(text)
    reviews = {(r["ecosystem"], r["name"]) for r in data.get("review", []) if r.get("why") and r.get("reviewed-by")}
    exceptions = {
        (e["ecosystem"], e["name"], e["version"]): e["reason"]
        for e in data.get("cooldown-exception", [])
        if ADVISORY.search(e.get("reason", ""))
    }
    return reviews, exceptions


@functools.lru_cache(maxsize=4096)
def fetch(url: str, method: str = "GET") -> tuple[bytes, dict[str, str]]:
    """Fetches a URL with three tries and a 20 s timeout; raises after the last one.

    Cached per URL, so an npm packument is read once per name however many versions are new."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 (fixed https registries)
                return resp.read(), dict(resp.headers)
        except OSError:
            if attempt == 2:
                raise
            time.sleep(2**attempt)
    raise OSError(url)


def published(eco: str, name: str, version: str) -> datetime:
    """When a version was published on its registry, in UTC."""
    if eco == "cargo":
        body, _ = fetch(f"https://crates.io/api/v1/crates/{name}/{version}")
        return datetime.fromisoformat(json.loads(body)["version"]["created_at"])
    if eco == "npm":
        body, _ = fetch(f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='@')}")
        return datetime.fromisoformat(json.loads(body)["time"][version].replace("Z", "+00:00"))
    if eco == "pypi":
        body, _ = fetch(f"https://pypi.org/pypi/{name}/{version}/json")
        return min(datetime.fromisoformat(u["upload_time_iso_8601"].replace("Z", "+00:00")) for u in json.loads(body)["urls"])
    return maven_published(name, version)


def maven_published(coord: str, version: str) -> datetime:
    """A Maven artifact's publish time: the Last-Modified of its POM on the first repo holding it."""
    group, artifact = coord.split(":")
    path = f"{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.pom"
    for base in MAVEN_REPOS:
        try:
            _, headers = fetch(f"{base}/{path}", method="HEAD")
        except OSError:
            continue
        return parsedate_to_datetime(headers["Last-Modified"])
    raise OSError(f"{coord}:{version} is in none of {', '.join(MAVEN_REPOS)}")


def problems(base: list[Package], head: list[Package], reviews_text: str, now: datetime) -> list[str]:
    """Lists every new package with no review and every new version younger than the cooldown."""
    reviews, exceptions = load_reviews(reviews_text)
    old_names = {(e, n) for e, n, _, _ in base}
    old_versions = {(e, n, v) for e, n, v, _ in base}
    out = sorted({f"{e} {n}: new package, add a [[review]] to {REVIEWS}" for e, n, _, _ in head if (e, n) not in old_names | reviews})
    for eco, name, version, when in sorted(set(head)):
        if (eco, name, version) in old_versions or (eco, name, version) in exceptions:
            continue
        out += cooldown_problem(eco, name, version, when, now)
    return out


def cooldown_problem(eco: str, name: str, version: str, when: str | None, now: datetime) -> list[str]:
    """One message if a new version is younger than the cooldown or cannot be dated, else none."""
    try:
        date = datetime.fromisoformat(when.replace("Z", "+00:00")) if when else published(eco, name, version)
    except (OSError, KeyError, ValueError) as err:
        return [f"{eco} {name} {version}: publish date unknown ({err}); unverified fails"]
    if now - date >= timedelta(days=COOLDOWN_DAYS):
        return []
    return [
        f"{eco} {name} {version}: published {date:%Y-%m-%d}, under {COOLDOWN_DAYS} days old; wait,"
        f" or add a [[cooldown-exception]] with the reason to {REVIEWS}"
    ]


# A cargo command that resolves dependencies, and the flags that pin it to the lockfile.
CARGO_RESOLVES = re.compile(r"\bcargo\s+(build|test|clippy|check|run|install|doc|bench|llvm-cov|nextest|chef\s+cook)\b")
CARGO_LOCKED = re.compile(r"--(locked|frozen)\b")


def unlocked_commands(text: str) -> list[str]:
    """Lists every command in a workflow or Dockerfile that can ignore its lockfile."""
    joined = re.sub(r"\\\n\s*", " ", text)
    out = []
    for line in joined.splitlines():
        cmd = line.split(" #", 1)[0].strip()
        if cmd.startswith("#") or not cmd:
            continue
        if CARGO_RESOLVES.search(cmd) and not CARGO_LOCKED.search(cmd) and "llvm-cov report" not in cmd:
            out.append(f"cargo without --locked: {cmd}")
        if re.search(r"\bpnpm\s+(install|i)\b", cmd) and "--frozen-lockfile" not in cmd:
            out.append(f"pnpm install without --frozen-lockfile: {cmd}")
        if re.search(r"\bnpm\s+(install|i)\b", cmd):
            out.append(f"npm install (use npm ci): {cmd}")
        out += unpinned_pip(cmd)
    if "tauri-apps/tauri-action" in text and not re.search(r"^\s*args:.*--\s+--locked", text, re.M):
        out.append("tauri-action without `-- --locked` in its args")
    return out


def unpinned_pip(cmd: str) -> list[str]:
    """Flags a pip install of a package with no exact `==` version (requirement files are read separately)."""
    m = re.search(r"\bpip3?\s+install\s+(.*)", cmd)
    if not m:
        return []
    args = [a for a in re.split(r"\s+", m[1].split("&&")[0].strip()) if a]
    skip_next = False
    bad = []
    for arg in args:
        if skip_next or arg.startswith("-"):
            skip_next = arg in ("-r", "--requirement", "-c", "--constraint")
            continue
        if "==" not in arg:
            bad.append(f"pip install without an exact version: {arg} in {cmd}")
    return bad


def missing_cooldowns(text: str) -> list[str]:
    """Flags a Dependabot config where an ecosystem has no cooldown of at least COOLDOWN_DAYS."""
    blocks = re.split(r"\n\s*-\s+package-ecosystem:", text)[1:]
    out = []
    for block in blocks:
        days = re.search(r"default-days:\s*(\d+)", block)
        if not days or int(days[1]) < COOLDOWN_DAYS:
            out.append(f"dependabot ecosystem{block.splitlines()[0]} has no {COOLDOWN_DAYS}-day cooldown")
    return out


def check_workflows() -> list[str]:
    """Runs the lockfile rule over every workflow and Dockerfile, and the cooldown rule over Dependabot."""
    paths = [p for p in git("ls-files").splitlines() if re.search(r"^\.github/workflows/.+\.ya?ml$|(^|/)Dockerfile$", p)]
    out = [f"{p}: {msg}" for p in paths for msg in unlocked_commands((REPO / p).read_text(encoding="utf-8"))]
    return out + missing_cooldowns((REPO / ".github/dependabot.yml").read_text(encoding="utf-8"))


def self_test() -> None:
    """Checks the parsers, the review and cooldown rules and the lockfile rule on fixed inputs."""
    cargo = '[[package]]\nname = "me"\nversion = "0.1.0"\n\n[[package]]\nname = "serde"\nversion = "1.0.1"\nsource = "registry+x"\n'
    assert parse_cargo(cargo) == [("cargo", "serde", "1.0.1", None)]
    pnpm = "lockfileVersion: '9.0'\n\npackages:\n\n  '@a/b@1.2.3':\n    resolution: {}\n\n  c@4.0.0-rc.1:\n    x\n\nsnapshots:\n\n  d@1.0.0:\n"
    assert parse_pnpm(pnpm) == [("npm", "@a/b", "1.2.3", None), ("npm", "c", "4.0.0-rc.1", None)]
    uv = '[[package]]\nname = "Foo_Bar"\nversion = "2.0"\nsource = { registry = "x" }\nsdist = { upload-time = "2026-01-02T00:00:00Z" }\n'
    assert parse_uv(uv) == [("pypi", "foo-bar", "2.0", "2026-01-02T00:00:00Z")]
    for broken in ("lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n",
                   "x\n\npackages:\n\n  foo@github.com/a/b#c:\n    r\n\nsnapshots:\n"):
        try:
            parse_pnpm(broken)
        except ValueError:
            continue
        raise AssertionError(f"accepted: {broken!r}")
    assert parse_gradle("# c\na.b:c:1.0=x\nempty=\n") == [("maven", "a.b:c", "1.0", None)]
    now = datetime(2026, 11, 12, tzinfo=UTC)
    base = [("pypi", "old", "1.0", "2020-01-01T00:00:00Z")]
    fresh, aged = ("pypi", "old", "1.1", "2026-11-10T00:00:00Z"), ("pypi", "old", "1.2", "2026-11-01T00:00:00Z")
    assert problems(base, base + [aged], "", now) == []
    assert len(problems(base, [fresh], "", now)) == 1
    exc = '[[cooldown-exception]]\necosystem = "pypi"\nname = "old"\nversion = "1.1"\nreason = "fixes CVE-2026-12345"\n'
    assert problems(base, [fresh], exc, now) == []
    assert len(problems(base, [fresh], exc.replace("CVE-2026-12345", "a security fix"), now)) == 1
    new = ("pypi", "new", "1.0", "2020-01-01T00:00:00Z")
    assert problems(base, [new], "", now) == [f"pypi new: new package, add a [[review]] to {REVIEWS}"]
    rev = '[[review]]\necosystem = "pypi"\nname = "new"\nreviewed-by = "x"\nwhy = "y"\n'
    assert problems(base, [new], rev, now) == []
    assert problems(base, [new], '[[review]]\necosystem = "pypi"\nname = "new"\n', now) != []
    bad = "run: cargo build --release -p x\nrun: pnpm install\nrun: npm i\nrun: pip install build\n"
    assert len(unlocked_commands(bad)) == 4, unlocked_commands(bad)
    good = "run: cargo build --locked -p x\nrun: cargo fmt --check\nrun: |\n  cargo test \\\n    --locked\nrun: pnpm install --frozen-lockfile\nrun: pip install a==1 -r req.txt\n"
    assert unlocked_commands(good) == [], unlocked_commands(good)
    tauri = "uses: tauri-apps/tauri-action@x\n  with:\n    args: --bundles deb"
    assert unlocked_commands(tauri) == ["tauri-action without `-- --locked` in its args"]
    assert unlocked_commands(tauri + " -- --locked") == []
    bot = "updates:\n  - package-ecosystem: npm\n    cooldown:\n      default-days: 7\n  - package-ecosystem: cargo\n    x: 1\n"
    assert missing_cooldowns(bot) == ["dependabot ecosystem cargo has no 7-day cooldown"]


def main() -> int:
    """Dispatches to the self-test, the workflow rule or the dependency rule."""
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--self-test":
        self_test()
        print("check-supply-chain: self-test OK")
        return 0
    if mode == "workflows":
        bad = check_workflows()
    elif mode == "deps" and len(sys.argv) == 3:
        reviews = (REPO / REVIEWS).read_text(encoding="utf-8") if (REPO / REVIEWS).exists() else ""
        try:
            bad = problems(packages_at(sys.argv[2]), packages_at(None), reviews, datetime.now(UTC))
        except ValueError as err:
            bad = [str(err)]
    else:
        print(__doc__, file=sys.stderr)
        return 2
    print("\n".join(bad) if bad else f"check-supply-chain {mode}: OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
