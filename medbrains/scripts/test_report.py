#!/usr/bin/env python3
"""Builds the inputs and the finish of the MedBrains test report (tests.medbrains.in).

The nightly E2E run (.github/workflows/e2e.yml) calls it between the test runs and
`allure generate` (config: apps/web/allurerc.mjs):

  label  <results-dir> <app>     fill epic/feature/story where a test set none
  junit  <junit.xml> <out-dir>   turn the Rust tests' nextest JUnit into Allure results
  theme  <report-dir>            MedBrains colours, fonts, logo and header links; drops
                                 the report's built-in Google Analytics tag
  --self-test                    check the above, and the theme's WCAG 2.2 AA contrast

Standard library only, so the job needs nothing installed for it.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOGO = REPO / "website/public/logo/medbrains-mark.svg"
DOCS_URL = "https://docs.medbrains.in"
SOURCE_URL = "https://github.com/medbrains/medbrains"

def labels_of(result: dict) -> dict[str, str]:
    """The first value of each label name on an Allure result."""
    found: dict[str, str] = {}
    for label in result.get("labels", []):
        found.setdefault(label.get("name", ""), label.get("value", ""))
    return found


def module_of(file_path: str) -> str:
    """The module a spec or test file covers, read from its name: `pharmacy-dispense.spec.ts`
    and `pharmacy.test.tsx` are both "pharmacy". A test sets `feature` itself to override."""
    stem = Path(file_path).name.split(".")[0]
    return re.split(r"[-_]", stem)[0] or stem


def source_file_of(labels: dict[str, str]) -> str:
    """The test file, from the reporter's `suite` label (Playwright) or `package`
    (`@medbrains/web.src.pages.x.test.tsx`, Vitest)."""
    if labels.get("suite", "").endswith((".ts", ".tsx")):
        return labels["suite"]
    package = labels.get("package", "").split(".", 1)[-1]
    parts = package.split(".")
    return "/".join(parts[:-3]) + "/" + ".".join(parts[-3:]) if len(parts) > 3 else package


def fill_labels(result: dict, app: str) -> dict:
    """Adds epic (app), feature (module) and story (scenario) labels the test did not set,
    so the report groups every test app → module → scenario."""
    labels = labels_of(result)
    source = source_file_of(labels)
    if source.startswith("src/"):  # Vitest: the describe block, else the file
        scenario = labels.get("parentSuite") or Path(source).name.split(".")[0]
    else:  # Playwright: the describe block, else the spec file
        scenario = labels.get("subSuite") or Path(source).name.split(".")[0]
    wanted = {"epic": app, "feature": module_of(source), "story": scenario}
    for name, value in wanted.items():
        if name not in labels and value:
            result.setdefault("labels", []).append({"name": name, "value": value})
    return result


# Videos and Playwright traces stay in the run's playwright-report artifact; in the published
# report, committed nightly to medbrains/tests, they would grow that repository without end.
HEAVY_ATTACHMENTS = {"video/webm", "application/vnd.allure.playwright-trace"}


def drop_heavy_attachments(node: dict, results_dir: Path) -> None:
    """Removes video and trace attachments from a result and its steps, files included."""
    kept = []
    for attachment in node.get("attachments", []):
        if attachment.get("type") in HEAVY_ATTACHMENTS:
            (results_dir / attachment.get("source", "")).unlink(missing_ok=True)
        else:
            kept.append(attachment)
    node["attachments"] = kept
    for step in node.get("steps", []):
        drop_heavy_attachments(step, results_dir)


def label_dir(results_dir: Path, app: str) -> int:
    """Fills the grouping labels on every result file in a directory and drops its heavy
    attachments; returns how many results."""
    count = 0
    for path in results_dir.glob("*-result.json"):
        result = json.loads(path.read_text())
        drop_heavy_attachments(result, results_dir)
        path.write_text(json.dumps(fill_labels(result, app)))
        count += 1
    return count


def junit_case_to_allure(case: ET.Element, suite_name: str, start_ms: int) -> dict:
    """One nextest JUnit testcase as an Allure result. The crate is the module and the
    test's module path the scenario: `medbrains-pharmacy::dispense` `tests::refuses_x`."""
    binary = case.get("classname") or suite_name
    name = case.get("name", "")
    crate = binary.split("::")[0].removeprefix("medbrains-")
    scenario = name.rsplit("::", 1)[0] if "::" in name else binary
    full_name = f"{binary}::{name}"
    failure = case.find("failure")
    if failure is None:
        failure = case.find("error")
    status = "passed"
    details: dict[str, str] = {}
    if case.find("skipped") is not None:
        status = "skipped"
    elif failure is not None:
        status = "failed" if failure.tag == "failure" else "broken"
        details = {"message": failure.get("message", ""), "trace": failure.text or ""}
    # nextest records a run's start and each test's length, not each test's start.
    duration_ms = int(float(case.get("time", "0")) * 1000)
    history_id = hashlib.md5(full_name.encode(), usedforsecurity=False).hexdigest()
    return {
        "uuid": str(uuid.uuid4()),
        "historyId": history_id,
        "testCaseId": history_id,
        "name": name.rsplit("::", 1)[-1],
        "fullName": full_name,
        "status": status,
        "statusDetails": details,
        "stage": "finished",
        "start": start_ms,
        "stop": start_ms + duration_ms,
        "labels": [
            {"name": "epic", "value": "server"},
            {"name": "feature", "value": crate},
            {"name": "story", "value": scenario},
            {"name": "framework", "value": "cargo-nextest"},
            {"name": "language", "value": "rust"},
        ],
    }


def junit_to_allure(junit: Path, out_dir: Path) -> int:
    """Writes one Allure result file per JUnit testcase; returns how many."""
    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    root = ET.parse(junit).getroot()
    for suite in root.iter("testsuite"):
        stamp = suite.get("timestamp") or root.get("timestamp")
        start_ms = int((datetime.fromisoformat(stamp) if stamp else datetime.now(UTC)).timestamp() * 1000)
        for case in suite.iter("testcase"):
            result = junit_case_to_allure(case, suite.get("name", ""), start_ms)
            (out_dir / f"{result['uuid']}-result.json").write_text(json.dumps(result))
            count += 1
    return count


# The report's CSS variables (Allure 3 Awesome UI) mapped to the website colours
# (website/src/styles/global.scss, packages/design-system/src/theme/figma-varspec.json).
# Dark is the app's neutral greys, never navy.
THEMES = {
    "light": {
        "--color-bg-canvas": "#f3f5f9",
        "--color-bg-primary": "#ffffff",
        "--color-bg-secondary": "#f3f5f9",
        "--color-bg-raised": "#ffffff",
        "--color-bg-neutral": "#dde2ea",
        "--color-text-primary": "#0b1220",
        "--color-text-secondary": "#3c4657",
        "--color-text-muted": "#5d677a",
        "--color-border-subtle": "#dde2ea",
        "--color-border-default": "#dde2ea",
        "--color-border-medium": "#dde2ea",
        "--color-border-control": "#c3cad6",
        "--color-border-strong": "#5d677a",
        "--color-focus-ring": "#0f62fe",
        "--color-link-text": "#0043ce",
        "--color-link-text-hover": "#0043ce",
        "--color-link-text-active": "#002d9c",
        "--color-intent-primary-bg": "#0f62fe",
        "--color-intent-primary-bg-hover": "#0043ce",
        "--color-intent-primary-bg-active": "#002d9c",
        "--color-intent-primary-text": "#0043ce",
        "--color-intent-primary-on-bg": "#ffffff",
        "--color-nav-item-bg-active": "rgb(15 98 254 / 12%)",
        "--color-nav-item-bg-active-hover": "rgb(15 98 254 / 18%)",
        "--color-nav-item-text-active": "#0043ce",
        "--color-nav-item-icon-active": "#0043ce",
        "--color-status-passed-bg": "#42be65",
        "--color-status-passed-on-bg": "#0b1220",
        "--color-status-passed-text": "#198038",
        "--color-status-passed-border": "#42be65",
        "--color-status-passed-chart": "#42be65",
        "--color-status-passed-chart-fill": "#42be65",
        "--color-status-passed-bg-subtle": "rgb(66 190 101 / 14%)",
        "--color-status-failed-bg": "#da1e28",
        "--color-status-failed-on-bg": "#ffffff",
        "--color-status-failed-text": "#da1e28",
        "--color-status-failed-border": "#da1e28",
        "--color-status-failed-chart": "#da1e28",
        "--color-status-failed-chart-fill": "#da1e28",
        "--color-status-failed-bg-subtle": "rgb(218 30 40 / 10%)",
    },
    "dark": {
        "--color-bg-canvas": "#111315",
        "--color-bg-primary": "#17191c",
        "--color-bg-secondary": "#1c1f23",
        "--color-bg-raised": "#24272c",
        "--color-bg-neutral": "#30343a",
        "--color-text-primary": "#e6e8eb",
        "--color-text-secondary": "#a9afb7",
        "--color-text-muted": "#a9afb7",
        "--color-border-subtle": "#30343a",
        "--color-border-default": "#30343a",
        "--color-border-medium": "#30343a",
        "--color-border-control": "#4a4f57",
        "--color-border-strong": "#a9afb7",
        "--color-focus-ring": "#78a9ff",
        "--color-link-text": "#78a9ff",
        "--color-link-text-hover": "#78a9ff",
        "--color-link-text-active": "#a6c8ff",
        "--color-intent-primary-bg": "#0f62fe",
        "--color-intent-primary-bg-hover": "#0043ce",
        "--color-intent-primary-bg-active": "#002d9c",
        "--color-intent-primary-text": "#78a9ff",
        "--color-intent-primary-on-bg": "#ffffff",
        "--color-nav-item-bg-active": "rgb(120 169 255 / 16%)",
        "--color-nav-item-bg-active-hover": "rgb(120 169 255 / 22%)",
        "--color-nav-item-text-active": "#78a9ff",
        "--color-nav-item-icon-active": "#78a9ff",
        "--color-status-passed-bg": "#42be65",
        "--color-status-passed-on-bg": "#111315",
        "--color-status-passed-text": "#42be65",
        "--color-status-passed-border": "#42be65",
        "--color-status-passed-chart": "#42be65",
        "--color-status-passed-chart-fill": "#42be65",
        "--color-status-passed-bg-subtle": "rgb(66 190 101 / 16%)",
        "--color-status-failed-bg": "#da1e28",
        "--color-status-failed-on-bg": "#ffffff",
        "--color-status-failed-text": "#ff8389",
        "--color-status-failed-border": "#ff8389",
        "--color-status-failed-chart": "#ff8389",
        "--color-status-failed-chart-fill": "#da1e28",
        "--color-status-failed-bg-subtle": "rgb(218 30 40 / 18%)",
    },
}

# Text and the surfaces it sits on, per theme: each pair must reach 4.5:1 (WCAG 2.2 AA).
CONTRAST_PAIRS = [
    ("--color-text-primary", "--color-bg-primary"),
    ("--color-text-secondary", "--color-bg-primary"),
    ("--color-text-muted", "--color-bg-canvas"),
    ("--color-text-muted", "--color-bg-secondary"),
    ("--color-link-text", "--color-bg-primary"),
    ("--color-link-text", "--color-bg-canvas"),
    ("--color-intent-primary-on-bg", "--color-intent-primary-bg"),
    ("--color-status-passed-text", "--color-bg-primary"),
    ("--color-status-passed-on-bg", "--color-status-passed-bg"),
    ("--color-status-failed-text", "--color-bg-primary"),
    ("--color-status-failed-on-bg", "--color-status-failed-bg"),
]

SHARED_VARS = {
    "--font-family": '"IBM Plex Sans", system-ui, sans-serif',
    "--font-family-mono": '"IBM Plex Mono", ui-monospace, monospace',
    # Carbon's sharp corners; only circles (status dots) keep their shape.
    **{f"--radius-{size}": "0" for size in ("0-25", "0-5", "1", "1-5", "2", "pill")},
}

FONTS_URL = (
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500"
    "&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
)
# The report loads Google Analytics from its page template; a public MedBrains page does not.
ANALYTICS = re.compile(r"<script async src=\"https://www\.googletagmanager\.com/.*?</script>\s*"
                       r"<script>.*?gtag\('config'.*?</script>", re.S)


def relative_luminance(hex_colour: str) -> float:
    """WCAG relative luminance of a #rrggbb colour."""
    channels = [int(hex_colour[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(fg: str, bg: str) -> float:
    """WCAG contrast ratio of two #rrggbb colours."""
    lighter, darker = sorted((relative_luminance(fg), relative_luminance(bg)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def theme_css() -> str:
    """The stylesheet: variables per theme under the report's own selectors (raised by `html`
    so they win over the bundled ones), sharp corners on its fixed-radius parts, the bar."""
    def block(selector: str, values: dict[str, str]) -> str:
        """One CSS rule of custom properties."""
        body = "".join(f"{name}:{value};" for name, value in values.items())
        return f"{selector}{{{body}}}"

    return "\n".join(
        [
            block("html:root", SHARED_VARS),
            block("html:root:not([data-theme=dark])", THEMES["light"] | {"--mb-bar-bg": "#ffffff"}),
            block("html:root[data-theme=dark]", THEMES["dark"] | {"--mb-bar-bg": "#17191c"}),
            '[class*="report-logo"],[class*="menu"],[class*="card"],button,input{border-radius:0!important}',
            ".mb-bar{display:flex;gap:16px;align-items:center;justify-content:flex-end;"
            "padding:8px 16px;font:14px/20px var(--font-family);background:var(--mb-bar-bg);"
            "border-bottom:1px solid var(--color-border-default)}",
            ".mb-bar a{color:var(--color-link-text);text-decoration:underline;min-height:24px;"
            "display:inline-flex;align-items:center}",
            ".mb-bar a:focus-visible{outline:2px solid var(--color-focus-ring);outline-offset:2px}",
        ]
    )


def theme_report(report_dir: Path) -> None:
    """Gives a generated report the MedBrains look: stylesheet, fonts, logo, a bar with the
    docs and source links, and no analytics tag."""
    index = report_dir / "index.html"
    html = ANALYTICS.sub("", index.read_text())
    if "googletagmanager" in html:
        raise SystemExit("the report's analytics tag changed shape; update ANALYTICS")
    (report_dir / "medbrains.css").write_text(theme_css())
    shutil.copy(LOGO, report_dir / "medbrains-mark.svg")
    head = (
        f'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link rel="stylesheet" href="{FONTS_URL}">'
        '<link rel="stylesheet" href="medbrains.css">'
    )
    bar = (
        '<nav class="mb-bar" aria-label="MedBrains">'
        f'<a href="{DOCS_URL}">Docs</a><a href="{SOURCE_URL}">Source code</a></nav>'
    )
    html = html.replace("</head>", head + "</head>", 1).replace("<body>", "<body>" + bar, 1)
    index.write_text(html)


def self_test() -> None:
    """Checks labelling, attachment slimming, the JUnit conversion and the theme's contrast."""
    playwright = {"labels": [{"name": "parentSuite", "value": "journeys"},
                             {"name": "suite", "value": "journeys/pharmacy-dispense.spec.ts"},
                             {"name": "feature", "value": "dispensing"}]}
    got = labels_of(fill_labels(playwright, "web"))
    assert got["epic"] == "web" and got["feature"] == "dispensing", got
    assert got["story"] == "pharmacy-dispense", got
    vitest = {"labels": [{"name": "parentSuite", "value": "Health intelligence"},
                         {"name": "package", "value": "@medbrains/web.src.pages.health-intel.test.tsx"}]}
    got = labels_of(fill_labels(vitest, "web"))
    assert got["feature"] == "health" and got["story"] == "Health intelligence", got

    with tempfile.TemporaryDirectory() as tmp:
        video = Path(tmp) / "v-attachment.webm"
        video.write_text("x")
        result = {"attachments": [{"type": "video/webm", "source": video.name},
                                  {"type": "image/png", "source": "shot.png"}],
                  "steps": [{"attachments": [{"type": "video/webm", "source": "gone.webm"}]}]}
        drop_heavy_attachments(result, Path(tmp))
        assert not video.exists() and [a["type"] for a in result["attachments"]] == ["image/png"]
        assert result["steps"][0]["attachments"] == []

    with tempfile.TemporaryDirectory() as tmp:
        junit = Path(tmp) / "junit.xml"
        junit.write_text(
            '<testsuites><testsuite name="medbrains-pharmacy::dispense" timestamp="2026-11-14T02:00:00Z">'
            '<testcase name="tests::refuses_schedule_x" classname="medbrains-pharmacy::dispense" time="0.5"/>'
            '<testcase name="ok" classname="medbrains-pharmacy::dispense" time="0.1">'
            '<failure message="boom">trace</failure></testcase>'
            '<testcase name="later" classname="medbrains-pharmacy::dispense"><skipped/></testcase>'
            "</testsuite></testsuites>"
        )
        out = Path(tmp) / "rust"
        assert junit_to_allure(junit, out) == 3
        results = [json.loads(p.read_text()) for p in out.glob("*-result.json")]
        first = next(r for r in results if r["name"] == "refuses_schedule_x")
        assert labels_of(first)["feature"] == "pharmacy" and labels_of(first)["story"] == "tests"
        assert first["start"] == 1_794_621_600_000 and first["stop"] == first["start"] + 500, first
    for theme, values in THEMES.items():
        for fg, bg in CONTRAST_PAIRS:
            ratio = contrast(values[fg], values[bg])
            assert ratio >= 4.5, f"{theme}: {fg} on {bg} is {ratio:.2f}:1, below 4.5:1"

    sample = ('<head></head><body><script async src="https://www.googletagmanager.com/gtag/js?id=G-1">'
              "</script>\n    <script>\n gtag('config', 'G-1', {});\n    </script>\n</body>")
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "index.html").write_text(sample)
        theme_report(Path(tmp))
        html = (Path(tmp) / "index.html").read_text()
        assert "googletagmanager" not in html and "medbrains.css" in html and "Source code" in html
    print("test_report.py self-test: ok")


def main(argv: list[str]) -> int:
    """Runs one subcommand; see the module docstring."""
    match argv:
        case ["--self-test"]:
            self_test()
        case ["label", results_dir, app]:
            print(f"labelled {label_dir(Path(results_dir), app)} results in {results_dir}")
        case ["junit", junit, out_dir]:
            print(f"converted {junit_to_allure(Path(junit), Path(out_dir))} Rust tests")
        case ["theme", report_dir]:
            theme_report(Path(report_dir))
        case _:
            print(__doc__, file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
