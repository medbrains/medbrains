#!/usr/bin/env python3
"""Generate a UI permission inventory for MedBrains web screens.

The scanner is intentionally heuristic. It does not try to parse TSX fully;
instead it extracts stable permission hooks, Mantine controls, common form
fields, tables, drawers, and API/service references so reviewers can see the
permissionable surface area screen by screen.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_SRC = ROOT / "apps" / "web" / "src"
PAGE_ROOT = WEB_SRC / "pages"
COMPONENT_ROOT = WEB_SRC / "components"
APP_TSX = WEB_SRC / "App.tsx"
OUT_JSON = ROOT / "docs" / "audit" / "ui-permission-inventory.json"
OUT_MD = ROOT / "docs" / "audit" / "ui-permission-inventory.md"

FIELD_COMPONENTS = (
    "TextInput",
    "PasswordInput",
    "Textarea",
    "NumberInput",
    "Select",
    "MultiSelect",
    "DateInput",
    "DatePickerInput",
    "TimeInput",
    "Checkbox",
    "Switch",
    "Radio",
    "SegmentedControl",
    "PinInput",
    "FileInput",
    "ColorInput",
    "TagsInput",
)

CONTROL_PATTERNS = {
    "buttons": r"<Button\b",
    "action_icons": r"<ActionIcon\b",
    "menu_items": r"<Menu\.Item\b",
    "drawers": r"<Drawer\b",
    "modals": r"<Modal\b",
    "tabs": r"<Tabs\.Tab\b",
    "tables": r"<(?:DataTable|Table)\b",
    "forms": r"<form\b|\buseForm\(",
}

SENSITIVE_FIELD_WORDS = (
    "aadhaar",
    "abha",
    "address",
    "allerg",
    "amount",
    "batch",
    "birth",
    "blood",
    "cause",
    "concession",
    "death",
    "diagnosis",
    "discount",
    "dob",
    "expiry",
    "gender",
    "guardian",
    "mlc",
    "mobile",
    "mother",
    "phone",
    "price",
    "religion",
    "shelf",
    "sponsor",
    "tax",
    "uhid",
)

HIGH_RISK_PATH_WORDS = (
    "audit",
    "billing",
    "blood",
    "consent",
    "documents",
    "emergency",
    "icu",
    "ipd",
    "lab",
    "mrd",
    "opd",
    "patient",
    "pharmacy",
    "radiology",
    "regulatory",
    "security",
)

PUBLIC_ROUTE_FILES = {
    "apps/web/src/pages/landing.tsx",
    "apps/web/src/pages/login.tsx",
    "apps/web/src/pages/onboarding/index.tsx",
}


@dataclass
class UiPermissionSurface:
    path: str
    kind: str
    lines: int
    page_guards: list[str]
    permission_checks: list[str]
    literal_permissions: list[str]
    api_refs: list[str]
    service_refs: list[str]
    controls: dict[str, int]
    field_labels: list[str]
    sensitive_field_labels: list[str]
    table_columns: list[str]
    tab_labels: list[str]
    status: str
    gaps: list[str]


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        cleaned = re.sub(r"\s+", " ", value).strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)
    return ordered


def display_expr(expr: str) -> str:
    expr = re.sub(r"\s+", " ", expr).strip()
    if len(expr) > 90:
        return f"{expr[:87]}..."
    return expr


def extract_permission_calls(text: str, hook: str) -> list[str]:
    pattern = re.compile(rf"\b{hook}\((.*?)\)", re.DOTALL)
    return unique([display_expr(match.group(1)) for match in pattern.finditer(text)])


def extract_literal_permissions(text: str) -> list[str]:
    # Dot-separated permission strings have at least module.resource.action.
    pattern = re.compile(r"""["']([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,})["']""")
    return unique([match.group(1) for match in pattern.finditer(text)])


def strip_braces(label: str) -> str:
    return label.strip().strip("{}").strip("'\"`")


def extract_field_labels(text: str) -> list[str]:
    fields: list[str] = []
    component_group = "|".join(FIELD_COMPONENTS)
    tag_pattern = re.compile(rf"<(?:{component_group})\b(?P<attrs>[^>]*)>", re.DOTALL)
    attr_pattern = re.compile(
        r"""(?:label|aria-label|placeholder|description)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\}|\{["']([^"']+)["']\})"""
    )
    name_pattern = re.compile(r"""(?:name|value)\s*=\s*(?:"([^"]+)"|'([^']+)')""")
    for tag in tag_pattern.finditer(text):
        attrs = tag.group("attrs")
        value = ""
        for match in attr_pattern.finditer(attrs):
            value = next(group for group in match.groups() if group)
            break
        if not value:
            match = name_pattern.search(attrs)
            if match:
                value = next(group for group in match.groups() if group)
        if value:
            fields.append(strip_braces(value))
    return unique(fields)


def extract_table_columns(text: str) -> list[str]:
    labels: list[str] = []
    explicit = re.compile(r"""(?:header|label|title)\s*:\s*["']([^"']+)["']""")
    accessor = re.compile(r"""(?:accessor|key)\s*:\s*["']([^"']+)["']""")
    for match in explicit.finditer(text):
        labels.append(match.group(1))
    for match in accessor.finditer(text):
        labels.append(match.group(1))
    return unique(labels[:80])


def extract_tab_labels(text: str) -> list[str]:
    tabs: list[str] = []
    pattern = re.compile(r"""<Tabs\.Tab\b(?P<attrs>[^>]*)>(?P<body>.*?)</Tabs\.Tab>""", re.DOTALL)
    value_pattern = re.compile(r"""value\s*=\s*["']([^"']+)["']""")
    for match in pattern.finditer(text):
        body = re.sub(r"<[^>]+>", " ", match.group("body"))
        body = re.sub(r"\s+", " ", body).strip()
        if body:
            tabs.append(body)
            continue
        value = value_pattern.search(match.group("attrs"))
        if value:
            tabs.append(value.group(1))
    return unique(tabs)


def extract_refs(text: str) -> tuple[list[str], list[str]]:
    api_refs = re.findall(r"\bapi\.([A-Za-z][A-Za-z0-9_]*)\b", text)
    service_refs = re.findall(r"\b([A-Za-z][A-Za-z0-9]*Service)\.([A-Za-z][A-Za-z0-9_]*)\b", text)
    return unique(api_refs), unique([f"{service}.{method}" for service, method in service_refs])


def count_controls(text: str) -> dict[str, int]:
    return {name: len(re.findall(pattern, text)) for name, pattern in CONTROL_PATTERNS.items()}


def is_sensitive(label: str) -> bool:
    lower = label.lower()
    return any(word in lower for word in SENSITIVE_FIELD_WORDS)


def classify_surface(path: Path, text: str, guard_count: int, checks: list[str], controls: dict[str, int]) -> tuple[str, list[str]]:
    rel = path.relative_to(ROOT).as_posix()
    gaps: list[str] = []
    is_page = PAGE_ROOT in path.parents
    exposed_route_files = get_exposed_route_files()
    is_exposed_route = rel in exposed_route_files
    is_public_allowed = rel in PUBLIC_ROUTE_FILES
    interactive_count = controls["buttons"] + controls["action_icons"] + controls["menu_items"]
    high_risk = any(word in rel.lower() for word in HIGH_RISK_PATH_WORDS)

    if is_exposed_route and guard_count == 0 and not is_public_allowed:
        gaps.append("route-level permission guard missing")
    if rel == "apps/web/src/pages/demo-dicom-fixtures.tsx":
        gaps.append("public demo fixture route should be removed or dev-gated")
    if interactive_count > 0 and not checks:
        gaps.append("interactive actions need element-level permission mapping")
    if controls["drawers"] > 0 and not checks:
        gaps.append("drawer open/create/update permissions not mapped")
    if controls["forms"] > 0 and "fieldAccess" not in text and "useField" not in text and "field_permission" not in text:
        gaps.append("form fields need field-level view/edit permission mapping")
    if controls["tables"] > 0 and "rowPermissions" not in text and "canView" not in text and "canUpdate" not in text:
        gaps.append("table row actions/columns need explicit permission mapping")
    if high_risk and controls["forms"] > 0:
        gaps.append("high-risk clinical/financial fields require masking and audit policy")

    if any(gap.startswith("route-level") for gap in gaps):
        status = "RED"
    elif gaps:
        status = "AMBER"
    else:
        status = "GREEN"
    return status, gaps


def resolve_page_import(import_path: str) -> str | None:
    if not import_path.startswith("./pages/"):
        return None
    relative = import_path.removeprefix("./")
    direct = WEB_SRC / relative.removeprefix("src/")
    candidates = [direct.with_suffix(".tsx"), direct / "index.tsx"]
    for candidate in candidates:
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()
    return None


def get_exposed_route_files() -> set[str]:
    text = APP_TSX.read_text(encoding="utf-8")
    files: set[str] = set()
    for match in re.finditer(r"""import\(["'](\./pages/[^"']+)["']\)""", text):
        resolved = resolve_page_import(match.group(1))
        if resolved:
            files.add(resolved)
    return files


def scan_file(path: Path, kind: str) -> UiPermissionSurface:
    text = path.read_text(encoding="utf-8")
    guards = extract_permission_calls(text, "useRequirePermission")
    has_checks = (
        extract_permission_calls(text, "useHasPermission")
        + extract_permission_calls(text, "useHasAnyPermission")
        + extract_permission_calls(text, "useHasAllPermissions")
    )
    literal_permissions = extract_literal_permissions(text)
    api_refs, service_refs = extract_refs(text)
    controls = count_controls(text)
    field_labels = extract_field_labels(text)
    sensitive_field_labels = [label for label in field_labels if is_sensitive(label)]
    table_columns = extract_table_columns(text)
    tab_labels = extract_tab_labels(text)
    status, gaps = classify_surface(path, text, len(guards), has_checks, controls)
    return UiPermissionSurface(
        path=path.relative_to(ROOT).as_posix(),
        kind=kind,
        lines=text.count("\n") + 1,
        page_guards=guards,
        permission_checks=has_checks,
        literal_permissions=literal_permissions,
        api_refs=api_refs,
        service_refs=service_refs,
        controls=controls,
        field_labels=field_labels,
        sensitive_field_labels=sensitive_field_labels,
        table_columns=table_columns,
        tab_labels=tab_labels,
        status=status,
        gaps=gaps,
    )


def candidate_files() -> list[tuple[Path, str]]:
    files: list[tuple[Path, str]] = []
    exposed_route_files = get_exposed_route_files()
    for path in PAGE_ROOT.rglob("*.tsx"):
        if path.name.endswith(".test.tsx"):
            continue
        rel = path.relative_to(ROOT).as_posix()
        files.append((path, "page" if rel in exposed_route_files else "page-orphan"))
    for path in COMPONENT_ROOT.rglob("*.tsx"):
        if path.name.endswith(".test.tsx"):
            continue
        text = path.read_text(encoding="utf-8")
        if any(token in text for token in ("<Drawer", "<Modal", "<Button", "<ActionIcon", "useForm(")):
            files.append((path, "component"))
    return sorted(files, key=lambda item: item[0].relative_to(ROOT).as_posix())


def markdown_table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    widths = [max(len(row[index]) for row in rows) for index in range(len(rows[0]))]
    output: list[str] = []
    header = rows[0]
    output.append("| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(header)) + " |")
    output.append("| " + " | ".join("-" * widths[index] for index in range(len(header))) + " |")
    for row in rows[1:]:
        output.append("| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(row)) + " |")
    return "\n".join(output)


def render_markdown(surfaces: list[UiPermissionSurface]) -> str:
    total = len(surfaces)
    counts = {status: sum(1 for item in surfaces if item.status == status) for status in ("GREEN", "AMBER", "RED")}
    high_risk = [
        item
        for item in surfaces
        if item.status != "GREEN" and any(word in item.path.lower() for word in HIGH_RISK_PATH_WORDS)
    ]
    high_risk.sort(
        key=lambda item: (
            item.status != "RED",
            -(item.controls["forms"] + item.controls["drawers"] + item.controls["tables"]),
            item.path,
        )
    )

    lines = [
        "# UI Permission Inventory",
        "",
        "_Generated by `scripts/audit_ui_permissions.py`. This is a heuristic inventory for assigning page, action, drawer, table, tab, and field-level permissions._",
        "",
        f"Surfaces scanned: **{total}**. GREEN {counts['GREEN']}, AMBER {counts['AMBER']}, RED {counts['RED']}.",
        "",
        "## High-Risk Gaps",
        "",
    ]
    rows = [["Surface", "Status", "Guard", "Controls", "Sensitive fields", "Gaps"]]
    for item in high_risk[:40]:
        guard = ", ".join(item.page_guards) if item.page_guards else "—"
        controls = (
            f"buttons {item.controls['buttons']}, icons {item.controls['action_icons']}, "
            f"drawers {item.controls['drawers']}, modals {item.controls['modals']}, "
            f"forms {item.controls['forms']}, tables {item.controls['tables']}"
        )
        sensitive = ", ".join(item.sensitive_field_labels[:5])
        if len(item.sensitive_field_labels) > 5:
            sensitive += f" +{len(item.sensitive_field_labels) - 5}"
        rows.append(
            [
                item.path.replace("apps/web/src/", ""),
                item.status,
                guard,
                controls,
                sensitive or "—",
                "; ".join(item.gaps[:3]),
            ]
        )
    lines.append(markdown_table(rows))
    lines.extend(["", "## Screen Inventory", ""])
    rows = [["Surface", "Kind", "Status", "Guard", "Perm checks", "Fields", "Tables", "Drawers", "Actions", "Gaps"]]
    for item in surfaces:
        guard = ", ".join(item.page_guards) if item.page_guards else "—"
        checks = str(len(item.permission_checks) + len(item.literal_permissions))
        actions = str(item.controls["buttons"] + item.controls["action_icons"] + item.controls["menu_items"])
        gaps = "; ".join(item.gaps[:2]) if item.gaps else "—"
        rows.append(
            [
                item.path.replace("apps/web/src/", ""),
                item.kind,
                item.status,
                guard,
                checks,
                str(len(item.field_labels)),
                str(item.controls["tables"]),
                str(item.controls["drawers"]),
                actions,
                gaps,
            ]
        )
    lines.append(markdown_table(rows))
    lines.extend(["", "## Permission Mapping Rules", ""])
    lines.extend(
        [
            "- Every routed page keeps one `useRequirePermission(...)` guard.",
            "- Every create/update/delete/approve/print/export/reprint/void/refund/concession action gets an element-level permission check.",
            "- Drawers and modals inherit both opener permission and submit permission; destructive submits require backend enforcement and audit.",
            "- Tables need column visibility, row action visibility, and export permission mapping.",
            "- High-risk clinical, MRD, pharmacy, billing, and identity fields need explicit view/edit/mask rules before role templates are finalized.",
            "- Public login/landing and onboarding steps are exceptions, but onboarding payloads still require backend authorization once tenant bootstrap is complete.",
        ]
    )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    surfaces = [scan_file(path, kind) for path, kind in candidate_files()]
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps([asdict(item) for item in surfaces], indent=2), encoding="utf-8")
    OUT_MD.write_text(render_markdown(surfaces), encoding="utf-8")
    counts = {status: sum(1 for item in surfaces if item.status == status) for status in ("GREEN", "AMBER", "RED")}
    print(f"scanned={len(surfaces)} green={counts['GREEN']} amber={counts['AMBER']} red={counts['RED']}")
    print(OUT_MD.relative_to(ROOT))
    print(OUT_JSON.relative_to(ROOT))


if __name__ == "__main__":
    main()
