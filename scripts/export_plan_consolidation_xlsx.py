#!/usr/bin/env python3
"""Export MedBrains plans, audit checklists, SRS extracts, and feature rows to one XLSX.

This intentionally avoids third-party Python dependencies so the export can run in a bare
developer shell. The workbook is written as Office Open XML directly.
"""

from __future__ import annotations

import hashlib
import html
import re
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / "medbrains"
OUTPUT = APP_ROOT / "docs" / "research" / "medbrains-plan-consolidated-2026-05-04.xlsx"
SRS_DOCX = Path("/Users/apple/Downloads/Draft Software Requirements Specification 04302026 (1).docx")
FEATURES_XLSX = ROOT / "MedBrains_Features.xlsx"

EXPLICIT_SOURCES = [
    Path("/Users/apple/.claude/plans/archive-delegated-discovering-milner-bloated.md"),
    Path("/tmp/medbrains-archive.md"),
    Path("/tmp/medbrains-slim.md"),
]


DOMAIN_KEYWORDS = {
    "SQLx / DB": ["sqlx", "migration", "database", "db", "postgres", "rls", "schema"],
    "Patient / OPD": ["patient", "opd", "appointment", "front office", "queue"],
    "IPD / Nursing": ["ipd", "admission", "discharge", "nursing", "icu", "bed"],
    "Pharmacy": ["pharmacy", "drug", "rx", "dispense", "ndps", "supplier", "grn", "batch"],
    "Diagnostics": ["lab", "radiology", "imaging", "x-ray", "ct", "usg", "diagnostic"],
    "Quality / NABH": ["nabh", "quality", "indicator", "sentinel", "fall", "pressure ulcer"],
    "Billing / Insurance": ["billing", "invoice", "insurance", "tpa", "gst", "finance"],
    "Infra / DevEx": ["infra", "deploy", "pipeline", "ci", "ship", "desktop", "mobile", "offline"],
    "Security / Compliance": ["security", "dpdp", "abdm", "audit", "consent", "privacy", "authz"],
    "Operations": ["housekeeping", "bme", "facilities", "diet", "cssd", "ambulance", "procurement"],
    "UI / UX": ["ui", "ux", "screen", "drawer", "button", "modal", "form", "page"],
}

PRIORITY_PATTERNS = [
    ("P0", re.compile(r"\bP0\b|critical|safety-critical|blocks core", re.I)),
    ("P1", re.compile(r"\bP1\b|high-impact|workaround exists", re.I)),
    ("P2", re.compile(r"\bP2\b|paper-cut|polish|minor", re.I)),
    ("P3", re.compile(r"\bP3\b|defer|later", re.I)),
]

EFFORT_RE = re.compile(
    r"(?i)(?:effort[: ]*)?(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*(?:day|days|week|weeks|month|months|hour|hours))"
)


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\x00", "")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    return text[:32000]


def rel_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def source_kind(path: Path) -> str:
    p = str(path).lower()
    if "docs/audit/screens" in p:
        return "screen checklist"
    if "docs/audit" in p:
        return "audit"
    if "docs/research" in p:
        return "research plan"
    if path.suffix.lower() == ".docx":
        return "SRS docx"
    if path.suffix.lower() == ".xlsx":
        return "feature tracker"
    if "deploy" in p:
        return "deployment plan"
    if ".claude" in p or "/tmp/" in p:
        return "archive"
    return "plan"


def discover_sources() -> list[Path]:
    patterns = [
        APP_ROOT / "docs" / "research",
        APP_ROOT / "docs" / "audit",
        APP_ROOT / "deploy",
    ]
    sources: list[Path] = []
    for base in patterns:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".md", ".docx", ".pdf"}:
                sources.append(path)
    sources.extend(p for p in EXPLICIT_SOURCES if p.exists())
    if SRS_DOCX.exists():
        sources.append(SRS_DOCX)
    if FEATURES_XLSX.exists():
        sources.append(FEATURES_XLSX)
    return sorted(set(sources), key=lambda p: (source_kind(p), str(p)))


def infer_priority(text: str) -> str:
    for priority, pattern in PRIORITY_PATTERNS:
        if pattern.search(text):
            return priority
    if re.search(r"\bphase\s*1\b|quick win|next-up|immediate", text, re.I):
        return "P1"
    return ""


def infer_status(text: str) -> str:
    value = text.lower()
    if "[x]" in value or "✅" in value or re.search(r"\b(done|closed|completed|shipped|green)\b", value):
        return "Done"
    if "[ ]" in value or re.search(r"\b(open|pending|todo|remaining|next-up|not started)\b", value):
        return "Open"
    if re.search(r"\b(partial|in progress|in-flight|building|ready to deploy)\b", value):
        return "In Progress"
    if re.search(r"\bdefer|deferred\b", value):
        return "Deferred"
    return ""


def infer_domain(text: str, path: Path) -> str:
    haystack = f"{path} {text}".lower()
    matches: list[tuple[str, int]] = []
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for word in keywords if word in haystack)
        if score:
            matches.append((domain, score))
    if not matches:
        return "General"
    return sorted(matches, key=lambda item: item[1], reverse=True)[0][0]


def infer_effort(text: str) -> str:
    match = EFFORT_RE.search(text)
    return match.group(1) if match else ""


def normalize_key(text: str) -> str:
    normalized = re.sub(r"`([^`]+)`", r"\1", text.lower())
    normalized = re.sub(r"https?://\S+", "", normalized)
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())[:180]


def strip_marker(line: str) -> str:
    line = re.sub(r"^\s*[-*+]\s+\[[ xX]\]\s*", "", line)
    line = re.sub(r"^\s*[-*+]\s+", "", line)
    line = re.sub(r"^\s*\d+\.\s+", "", line)
    line = line.replace("✅", "").replace("⚠️", "").replace("❌", "").strip()
    return line


def is_markdown_separator(line: str) -> bool:
    return bool(re.fullmatch(r"\s*\|?[\s:\-|]+\|?\s*", line))


def split_table_row(line: str) -> list[str]:
    value = line.strip().strip("|")
    return [cell.strip() for cell in value.split("|")]


def parse_markdown(path: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    items: list[dict[str, str]] = []
    checkboxes: list[dict[str, str]] = []
    issues: list[dict[str, str]] = []
    heading_stack: list[str] = []
    table_header: list[str] | None = None
    source = rel_path(path)
    important_plan = "docs/research" in source or source_kind(path) in {"archive", "deployment plan"}

    for line_no, raw in enumerate(text.splitlines(), start=1):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            level = len(heading.group(1))
            title = clean_text(heading.group(2).strip())
            heading_stack = heading_stack[: level - 1] + [title]
            item = make_item(
                source=source,
                line_no=line_no,
                section=" > ".join(heading_stack[:-1]),
                item_type="Section",
                title=title,
                raw=line,
                path=path,
            )
            if re.search(r"track|phase|goal|module|recommended|execution|plan|why|verification", title, re.I):
                items.append(item)
            table_header = None
            continue

        if stripped.startswith("|") and "|" in stripped[1:]:
            if is_markdown_separator(stripped):
                continue
            cells = split_table_row(stripped)
            if table_header is None:
                table_header = cells
                continue
            row = {table_header[i] if i < len(table_header) else f"col_{i+1}": cells[i] for i in range(len(cells))}
            row_text = " | ".join(cells)
            if "issues.md" in source.lower():
                issues.append(
                    {
                        "Source": source,
                        "Line": str(line_no),
                        "ID": row.get("ID", row.get("Id", "")),
                        "Page": row.get("page", row.get("Page", "")),
                        "Severity": row.get("severity", row.get("Severity", "")),
                        "Summary": row.get("one-line summary", row.get("Summary", "")),
                        "Repro": row.get("repro", row.get("Repro", "")),
                        "Fix Hint": row.get("fix-hint", row.get("Fix Hint", "")),
                        "Status": row.get("status", row.get("Status", "")),
                    }
                )
            if important_plan or any(k.lower() in row_text.lower() for k in ["p0", "p1", "pending", "open", "effort", "fix"]):
                items.append(
                    make_item(
                        source=source,
                        line_no=line_no,
                        section=" > ".join(heading_stack),
                        item_type="Table Row",
                        title=row_text,
                        raw=line,
                        path=path,
                    )
                )
            continue

        checkbox = re.match(r"^\s*[-*+]\s+\[([ xX])\]\s+(.+)$", line)
        if checkbox:
            title = clean_text(checkbox.group(2).strip())
            status = "Done" if checkbox.group(1).lower() == "x" else "Open"
            page = source.replace("docs/audit/screens/", "").removesuffix(".md")
            checkboxes.append(
                {
                    "Page": page,
                    "Source": source,
                    "Line": str(line_no),
                    "Status": status,
                    "Section": " > ".join(heading_stack),
                    "Check": title,
                    "Domain": infer_domain(title, path),
                }
            )
            items.append(
                make_item(
                    source=source,
                    line_no=line_no,
                    section=" > ".join(heading_stack),
                    item_type="Checkbox",
                    title=title,
                    raw=line,
                    path=path,
                    status=status,
                )
            )
            continue

        bullet = re.match(r"^\s*(?:[-*+]|\d+\.)\s+(.+)$", line)
        if bullet and (important_plan or "docs/audit" not in source):
            title = clean_text(strip_marker(line))
            if title:
                items.append(
                    make_item(
                        source=source,
                        line_no=line_no,
                        section=" > ".join(heading_stack),
                        item_type="Bullet",
                        title=title,
                        raw=line,
                        path=path,
                    )
                )

    return items, checkboxes, issues


def make_item(
    *,
    source: str,
    line_no: int,
    section: str,
    item_type: str,
    title: str,
    raw: str,
    path: Path,
    status: str = "",
) -> dict[str, str]:
    text = f"{section} {title} {raw}"
    track = ""
    for part in section.split(" > "):
        if re.search(r"\b(track|phase|goal|module|sprint)\b", part, re.I):
            track = part
    return {
        "ID": "",
        "Priority": infer_priority(text),
        "Status": status or infer_status(text),
        "Domain": infer_domain(text, path),
        "Track / Module": track,
        "Item Type": item_type,
        "Action / Requirement": clean_text(title),
        "Evidence / Notes": clean_text(section),
        "Effort": infer_effort(text),
        "Source": source,
        "Line": str(line_no),
        "Dedup Key": normalize_key(title),
    }


def extract_docx_paragraphs(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    paragraphs: list[dict[str, str]] = []
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    for idx, para in enumerate(root.findall(".//w:p", ns), start=1):
        texts = [node.text or "" for node in para.findall(".//w:t", ns)]
        text = clean_text("".join(texts).strip())
        if not text:
            continue
        paragraphs.append(
            {
                "Source": str(path),
                "Paragraph": str(idx),
                "Text": text,
                "Domain": infer_domain(text, path),
                "Priority": infer_priority(text),
                "Status": infer_status(text),
            }
        )
    return paragraphs


def extract_docx_items(path: Path, paragraphs: list[dict[str, str]]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    section = ""
    for row in paragraphs:
        text = row["Text"]
        is_heading = len(text) <= 140 and bool(re.match(r"^\d+(?:\.\d+)*\s+|^[A-Z][A-Za-z /&()-]{3,}$", text))
        is_action = bool(re.search(r"\b(shall|must|required|workflow|module|feature|integration|approval|audit|report|dashboard)\b", text, re.I))
        if is_heading:
            section = text
        if is_heading or is_action:
            items.append(
                make_item(
                    source=str(path),
                    line_no=int(row["Paragraph"]),
                    section=section,
                    item_type="SRS Clause" if is_action else "SRS Section",
                    title=text,
                    raw=text,
                    path=path,
                )
            )
    return items


def col_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch.upper()) - 64)
    return value


def read_existing_xlsx(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    ns = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(path) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst.findall("main:si", ns):
                shared.append("".join(t.text or "" for t in si.findall(".//main:t", ns)))

        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("pkgrel:Relationship", ns)}
        rows_out: list[dict[str, str]] = []

        for sheet in workbook.findall("main:sheets/main:sheet", ns):
            sheet_name = sheet.attrib.get("name", "Sheet")
            rel_id = sheet.attrib.get(f"{{{ns['rel']}}}id", "")
            target = rel_map.get(rel_id, "")
            if not target:
                continue
            normalized_target = target.lstrip("/")
            sheet_path = normalized_target if normalized_target.startswith("xl/") else f"xl/{normalized_target}"
            sheet_root = ET.fromstring(zf.read(sheet_path))
            raw_rows: list[tuple[int, list[str]]] = []
            max_col = 0
            for row in sheet_root.findall(".//main:sheetData/main:row", ns):
                row_num = int(row.attrib.get("r", len(raw_rows) + 1))
                values: dict[int, str] = {}
                for cell in row.findall("main:c", ns):
                    ref = cell.attrib.get("r", "")
                    idx = col_index(ref) if ref else len(values) + 1
                    max_col = max(max_col, idx)
                    ctype = cell.attrib.get("t", "")
                    value = ""
                    if ctype == "s":
                        v = cell.find("main:v", ns)
                        if v is not None and v.text is not None:
                            si = int(v.text)
                            value = shared[si] if 0 <= si < len(shared) else ""
                    elif ctype == "inlineStr":
                        value = "".join(t.text or "" for t in cell.findall(".//main:t", ns))
                    else:
                        v = cell.find("main:v", ns)
                        value = v.text if v is not None and v.text is not None else ""
                    values[idx] = clean_text(value)
                if values:
                    raw_rows.append((row_num, [values.get(i, "") for i in range(1, max_col + 1)]))

            header_idx = None
            header: list[str] = []
            for i, (_, vals) in enumerate(raw_rows[:20]):
                lowered = [v.strip().lower() for v in vals]
                if "module" in lowered and "feature" in lowered:
                    header_idx = i
                    header = vals
                    break
            if header_idx is None:
                continue
            header_map = {name.strip(): pos for pos, name in enumerate(header) if name.strip()}
            wanted = ["S.No", "Module", "Sub-Module", "Feature", "Source", "Priority", "Status", "RFC Ref", "Web", "Mobile", "TV"]
            for row_num, vals in raw_rows[header_idx + 1 :]:
                def get(name: str) -> str:
                    idx = header_map.get(name)
                    return vals[idx] if idx is not None and idx < len(vals) else ""

                feature = get("Feature")
                module = get("Module")
                if not feature and not module:
                    continue
                rows_out.append(
                    {
                        "Workbook": rel_path(path),
                        "Sheet": sheet_name,
                        "Row": str(row_num),
                        **{name: get(name) for name in wanted},
                    }
                )
        return rows_out


def feature_items(rows: list[dict[str, str]], path: Path) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for row in rows:
        feature = row.get("Feature", "")
        if not feature:
            continue
        source = f"{row.get('Workbook', rel_path(path))}::{row.get('Sheet', '')}"
        module = row.get("Module", "")
        status = row.get("Status", "")
        priority = row.get("Priority", "")
        text = f"{module} {row.get('Sub-Module', '')} {feature} {priority} {status}"
        items.append(
            {
                "ID": "",
                "Priority": priority or infer_priority(text),
                "Status": status or infer_status(text),
                "Domain": infer_domain(text, path),
                "Track / Module": module,
                "Item Type": "Feature Tracker Row",
                "Action / Requirement": clean_text(feature),
                "Evidence / Notes": clean_text(row.get("Sub-Module", "")),
                "Effort": "",
                "Source": source,
                "Line": row.get("Row", ""),
                "Dedup Key": normalize_key(feature),
            }
        )
    return items


def source_inventory(paths: Iterable[Path], item_counts: Counter[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in paths:
        exists = path.exists()
        size = path.stat().st_size if exists else 0
        line_count = ""
        sha = ""
        if exists and path.suffix.lower() == ".md":
            text = path.read_text(encoding="utf-8", errors="ignore")
            line_count = str(text.count("\n") + 1)
            sha = hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()[:12]
        elif exists:
            data = path.read_bytes()
            sha = hashlib.sha1(data).hexdigest()[:12]
        key = rel_path(path)
        rows.append(
            {
                "Source": key,
                "Kind": source_kind(path),
                "Exists": "Yes" if exists else "No",
                "Size KB": str(round(size / 1024, 1)),
                "Lines": line_count,
                "Extracted Items": str(item_counts.get(key, 0)),
                "SHA1": sha,
            }
        )
    return rows


def make_dashboard_rows(
    items: list[dict[str, str]],
    sources: list[dict[str, str]],
    checkboxes: list[dict[str, str]],
    issues: list[dict[str, str]],
    feature_rows: list[dict[str, str]],
) -> list[list[object]]:
    status = Counter(row.get("Status", "") or "Unclassified" for row in items)
    priority = Counter(row.get("Priority", "") or "Unclassified" for row in items)
    domain = Counter(row.get("Domain", "") or "General" for row in items)
    rows: list[list[object]] = [
        ["Metric", "Value", "Notes"],
        ["Generated At", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "Single workbook generated from local plan/research/audit/SRS sources"],
        ["Source Files Included", len(sources), "Markdown plans, audit files, screen checklists, SRS docx, and feature tracker"],
        ["Consolidated Items", len(items), "Feature rows + bullets/checklists/sections/clauses"],
        ["Feature Tracker Rows", len(feature_rows), "Rows parsed from MedBrains_Features.xlsx"],
        ["Screen Checklist Rows", len(checkboxes), "docs/audit/screens/**/*.md checkboxes"],
        ["Audit Issue Rows", len(issues), "Parsed from docs/audit/issues.md when table-shaped"],
        ["Open / Pending Items", status.get("Open", 0), "Includes unchecked checklist rows and explicit pending/open items"],
        ["In Progress Items", status.get("In Progress", 0), "Explicit in-progress/partial items"],
        ["Done Items", status.get("Done", 0), "Useful for avoiding duplicate implementation"],
        ["P0 Items", priority.get("P0", 0), "Critical / patient-safety / blocking"],
        ["P1 Items", priority.get("P1", 0), "High-impact next execution"],
        ["P2 Items", priority.get("P2", 0), "Polish / paper cuts / deferred quality"],
        ["", "", ""],
        ["Top Domains", "Item Count", "Use this for staffing parallel workstreams"],
    ]
    for name, count in domain.most_common(12):
        rows.append([name, count, ""])
    rows.extend(
        [
            ["", "", ""],
            ["Standing Engineering Gates", "Required", "Policy"],
            ["SQLx compile-time macros", "Yes", "No new runtime SQLx queries; offline cache by default"],
            ["Source-workflow evidence", "Yes", "NABH evidence should be mirrored from real module events, not duplicate capture screens"],
            ["UI included", "Yes", "Source screens must expose business state, guardrails, and verification cues"],
            ["Run before ship", "make check-all", "Then typecheck/cargo check and smoke where server is available"],
        ]
    )
    return rows


def dedup_rows(items: list[dict[str, str]]) -> list[dict[str, str]]:
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for item in items:
        key = item.get("Dedup Key", "")
        if key:
            groups[key].append(item)
    rows: list[dict[str, str]] = []
    for key, members in sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True):
        if len(members) < 2:
            continue
        sources = sorted({m["Source"] for m in members})
        rows.append(
            {
                "Duplicate Key": key,
                "Count": str(len(members)),
                "Representative": members[0].get("Action / Requirement", ""),
                "Priority": next((m.get("Priority", "") for m in members if m.get("Priority")), ""),
                "Status Mix": ", ".join(f"{k}:{v}" for k, v in Counter(m.get("Status", "") or "Unclassified" for m in members).items()),
                "Sources": "; ".join(sources)[:2000],
            }
        )
    return rows


def row_dicts_to_matrix(rows: list[dict[str, str]], headers: list[str]) -> list[list[object]]:
    return [headers] + [[row.get(header, "") for header in headers] for row in rows]


def column_letter(idx: int) -> str:
    letters = ""
    while idx:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def xml_escape(value: object) -> str:
    return html.escape(clean_text(value), quote=True)


def cell_xml(row_idx: int, col_idx: int, value: object, style: int = 0) -> str:
    ref = f"{column_letter(col_idx)}{row_idx}"
    style_attr = f' s="{style}"' if style else ""
    if value is None or value == "":
        return f'<c r="{ref}"{style_attr}/>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'
    text = xml_escape(value)
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t>{text}</t></is></c>'


def sheet_xml(name: str, matrix: list[list[object]], widths: list[int] | None = None) -> str:
    max_cols = max((len(row) for row in matrix), default=1)
    max_rows = len(matrix)
    widths = widths or []
    cols = []
    for idx in range(1, max_cols + 1):
        width = widths[idx - 1] if idx - 1 < len(widths) else (18 if idx <= 4 else 28)
        cols.append(f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>')
    rows = []
    for r_idx, row in enumerate(matrix, start=1):
        height_attr = ' ht="22" customHeight="1"' if r_idx == 1 else ""
        cells = []
        for c_idx in range(1, max_cols + 1):
            value = row[c_idx - 1] if c_idx - 1 < len(row) else ""
            style = 1 if r_idx == 1 else 6
            if r_idx > 1 and str(value).lower() in {"p0", "critical", "open"}:
                style = 5
            elif r_idx > 1 and str(value).lower() == "done":
                style = 3
            elif r_idx > 1 and str(value).lower() in {"in progress", "partial"}:
                style = 4
            cells.append(cell_xml(r_idx, c_idx, value, style))
        rows.append(f'<row r="{r_idx}"{height_attr}>{"".join(cells)}</row>')
    dimension = f"A1:{column_letter(max_cols)}{max(max_rows, 1)}"
    auto_filter = f'<autoFilter ref="{dimension}"/>' if max_rows > 1 and name != "Dashboard" else ""
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="{dimension}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>{''.join(cols)}</cols>
  <sheetData>{''.join(rows)}</sheetData>
  {auto_filter}
</worksheet>'''


def style_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><name val="Aptos"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4CCCC"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


def write_xlsx(path: Path, sheets: list[tuple[str, list[list[object]], list[int] | None]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet_files = [f"worksheets/sheet{i}.xml" for i in range(1, len(sheets) + 1)]
    workbook_sheets = []
    rels = []
    overrides = [
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for idx, (name, _, _) in enumerate(sheets, start=1):
        safe_name = re.sub(r"[\[\]:*?/\\]", "_", name)[:31] or f"Sheet{idx}"
        workbook_sheets.append(f'<sheet name="{xml_escape(safe_name)}" sheetId="{idx}" r:id="rId{idx}"/>')
        rels.append(
            f'<Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="{sheet_files[idx - 1]}"/>'
        )
        overrides.append(
            f'<Override PartName="/xl/{sheet_files[idx - 1]}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    rels.append(
        f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    )

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  {''.join(overrides)}
</Types>''',
        )
        zf.writestr(
            "_rels/.rels",
            '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>''',
        )
        zf.writestr(
            "xl/workbook.xml",
            f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>{''.join(workbook_sheets)}</sheets>
</workbook>''',
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(rels)}</Relationships>''',
        )
        zf.writestr("xl/styles.xml", style_xml())
        created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        zf.writestr(
            "docProps/core.xml",
            f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>MedBrains Consolidated Plan Workbook</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>''',
        )
        zf.writestr(
            "docProps/app.xml",
            f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>MedBrains Plan Export</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(sheets)}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="{len(sheets)}" baseType="lpstr">{''.join(f'<vt:lpstr>{xml_escape(name[:31])}</vt:lpstr>' for name, _, _ in sheets)}</vt:vector></TitlesOfParts>
</Properties>''',
        )
        for idx, (name, matrix, widths) in enumerate(sheets, start=1):
            zf.writestr(f"xl/{sheet_files[idx - 1]}", sheet_xml(name, matrix, widths))


def main() -> None:
    sources = discover_sources()
    all_items: list[dict[str, str]] = []
    all_checkboxes: list[dict[str, str]] = []
    all_issues: list[dict[str, str]] = []

    for path in sources:
        if path.suffix.lower() == ".md":
            items, checkboxes, issues = parse_markdown(path)
            all_items.extend(items)
            all_checkboxes.extend(checkboxes)
            all_issues.extend(issues)

    srs_rows = extract_docx_paragraphs(SRS_DOCX)
    all_items.extend(extract_docx_items(SRS_DOCX, srs_rows))

    feature_rows = read_existing_xlsx(FEATURES_XLSX)
    all_items.extend(feature_items(feature_rows, FEATURES_XLSX))

    for idx, item in enumerate(all_items, start=1):
        item["ID"] = f"MBP-{idx:05d}"

    source_counts = Counter(item["Source"].split("::")[0] for item in all_items)
    source_rows = source_inventory(sources, source_counts)
    dedup = dedup_rows(all_items)

    item_headers = [
        "ID",
        "Priority",
        "Status",
        "Domain",
        "Track / Module",
        "Item Type",
        "Action / Requirement",
        "Evidence / Notes",
        "Effort",
        "Source",
        "Line",
        "Dedup Key",
    ]
    source_headers = ["Source", "Kind", "Exists", "Size KB", "Lines", "Extracted Items", "SHA1"]
    checkbox_headers = ["Page", "Source", "Line", "Status", "Section", "Check", "Domain"]
    issue_headers = ["Source", "Line", "ID", "Page", "Severity", "Summary", "Repro", "Fix Hint", "Status"]
    feature_headers = [
        "Workbook",
        "Sheet",
        "Row",
        "S.No",
        "Module",
        "Sub-Module",
        "Feature",
        "Source",
        "Priority",
        "Status",
        "RFC Ref",
        "Web",
        "Mobile",
        "TV",
    ]
    srs_headers = ["Source", "Paragraph", "Text", "Domain", "Priority", "Status"]
    dedup_headers = ["Duplicate Key", "Count", "Representative", "Priority", "Status Mix", "Sources"]

    sheets = [
        ("Dashboard", make_dashboard_rows(all_items, source_rows, all_checkboxes, all_issues, feature_rows), [28, 18, 72]),
        ("Consolidated_Items", row_dicts_to_matrix(all_items, item_headers), [14, 10, 14, 18, 28, 18, 70, 55, 12, 45, 10, 36]),
        ("Execution_Roadmap", row_dicts_to_matrix([i for i in all_items if i.get("Priority") in {"P0", "P1"} or "phase" in i.get("Track / Module", "").lower()], item_headers), [14, 10, 14, 18, 28, 18, 70, 55, 12, 45, 10, 36]),
        ("Feature_Tracker", row_dicts_to_matrix(feature_rows, feature_headers), [14, 24, 8, 10, 24, 28, 72, 18, 10, 14, 18, 8, 8, 8]),
        ("Screen_Checklists", row_dicts_to_matrix(all_checkboxes, checkbox_headers), [40, 44, 8, 12, 48, 90, 18]),
        ("Audit_Issues", row_dicts_to_matrix(all_issues, issue_headers), [34, 8, 12, 28, 12, 70, 70, 70, 14]),
        ("SRS_Extract", row_dicts_to_matrix(srs_rows, srs_headers), [42, 10, 120, 18, 10, 14]),
        ("Source_Files", row_dicts_to_matrix(source_rows, source_headers), [74, 18, 10, 10, 10, 14, 16]),
        ("Dedup_Buckets", row_dicts_to_matrix(dedup, dedup_headers), [42, 10, 80, 10, 28, 120]),
    ]

    write_xlsx(OUTPUT, sheets)
    print(f"Wrote {OUTPUT}")
    print(f"Sources: {len(source_rows)}")
    print(f"Items: {len(all_items)}")
    print(f"Feature rows: {len(feature_rows)}")
    print(f"Screen checks: {len(all_checkboxes)}")
    print(f"Audit issues: {len(all_issues)}")
    print(f"SRS paragraphs: {len(srs_rows)}")


if __name__ == "__main__":
    main()
