#!/usr/bin/env python3
"""Add aria-label to all ActionIcon components missing them.

Scans all .tsx files in apps/web/src/ and patches ActionIcon elements
that don't have aria-label by inferring from the child icon name.

Usage:
    python3 scripts/fix_aria_labels.py
    python3 scripts/fix_aria_labels.py --dry-run
"""

import re
import sys
import os
from pathlib import Path

# Icon name → aria-label mapping
ICON_LABELS = {
    "IconPencil": "Edit",
    "IconEdit": "Edit",
    "IconTrash": "Delete",
    "IconTrashX": "Delete",
    "IconEye": "View details",
    "IconEyeOff": "Hide",
    "IconPlus": "Add",
    "IconX": "Close",
    "IconCheck": "Confirm",
    "IconCheckbox": "Select",
    "IconRefresh": "Refresh",
    "IconReload": "Reload",
    "IconDownload": "Download",
    "IconUpload": "Upload",
    "IconPrinter": "Print",
    "IconCopy": "Copy",
    "IconClipboard": "Copy to clipboard",
    "IconSearch": "Search",
    "IconFilter": "Filter",
    "IconSortAscending": "Sort ascending",
    "IconSortDescending": "Sort descending",
    "IconChevronRight": "Expand",
    "IconChevronLeft": "Collapse",
    "IconChevronDown": "Expand",
    "IconChevronUp": "Collapse",
    "IconArrowUp": "Move up",
    "IconArrowDown": "Move down",
    "IconArrowLeft": "Go back",
    "IconArrowRight": "Go forward",
    "IconSettings": "Settings",
    "IconDotsVertical": "More actions",
    "IconDots": "More actions",
    "IconMenu2": "Menu",
    "IconBell": "Notifications",
    "IconMail": "Email",
    "IconPhone": "Call",
    "IconStar": "Favorite",
    "IconStarFilled": "Remove favorite",
    "IconHeart": "Like",
    "IconShare": "Share",
    "IconLink": "Copy link",
    "IconExternalLink": "Open in new tab",
    "IconMaximize": "Maximize",
    "IconMinimize": "Minimize",
    "IconFullscreen": "Fullscreen",
    "IconLock": "Lock",
    "IconLockOpen": "Unlock",
    "IconUserPlus": "Add user",
    "IconUserMinus": "Remove user",
    "IconUser": "User",
    "IconUsers": "Users",
    "IconCalendar": "Calendar",
    "IconClock": "Time",
    "IconAlertTriangle": "Warning",
    "IconAlertCircle": "Alert",
    "IconInfoCircle": "Info",
    "IconQuestionMark": "Help",
    "IconMoon": "Dark mode",
    "IconSun": "Light mode",
    "IconLogout": "Logout",
    "IconLogin": "Login",
    "IconHome": "Home",
    "IconFile": "File",
    "IconFileText": "Document",
    "IconPhoto": "Image",
    "IconCamera": "Camera",
    "IconMicrophone": "Microphone",
    "IconPlayerPlay": "Play",
    "IconPlayerPause": "Pause",
    "IconPlayerStop": "Stop",
    "IconVolume": "Volume",
    "IconBan": "Block",
    "IconCircleCheck": "Approve",
    "IconCircleX": "Reject",
    "IconRotate": "Rotate",
    "IconSwitch": "Switch",
    "IconToggleLeft": "Toggle off",
    "IconToggleRight": "Toggle on",
    "IconGripVertical": "Drag to reorder",
    "IconSend": "Send",
    "IconMessageCircle": "Comment",
    "IconPinned": "Pin",
    "IconPinnedOff": "Unpin",
    "IconArchive": "Archive",
    "IconRestore": "Restore",
    "IconHistory": "History",
    "IconBookmark": "Bookmark",
    "IconTag": "Tag",
    "IconFlag": "Flag",
    "IconBug": "Report bug",
    "IconCode": "View code",
    "IconTerminal": "Terminal",
    "IconDatabase": "Database",
    "IconCloud": "Cloud",
    "IconWifi": "Network",
    "IconBluetooth": "Bluetooth",
    "IconMap": "Map",
    "IconNavigation": "Navigate",
    "IconCompass": "Compass",
    "IconZoomIn": "Zoom in",
    "IconZoomOut": "Zoom out",
    "IconCrop": "Crop",
    "IconColorPicker": "Pick color",
    "IconPalette": "Theme",
    "IconBrush": "Draw",
    "IconEraser": "Erase",
    "IconScissors": "Cut",
    "IconClipboardCheck": "Mark complete",
    "IconClipboardList": "Checklist",
    "IconList": "List",
    "IconLayoutGrid": "Grid view",
    "IconLayoutList": "List view",
    "IconTable": "Table",
    "IconColumns": "Columns",
    "IconRows": "Rows",
    "IconAdjustments": "Adjust",
    "IconTool": "Tools",
    "IconWrench": "Configure",
    "IconHammer": "Build",
    "IconKey": "Key",
    "IconShield": "Security",
    "IconShieldCheck": "Verified",
    "IconFingerprint": "Biometric",
    "IconQrcode": "QR code",
    "IconBarcode": "Barcode",
    "IconScan": "Scan",
    "IconFlask": "Lab",
    "IconTestPipe": "Test",
    "IconStethoscope": "Clinical",
    "IconPill": "Medication",
    "IconVaccine": "Vaccine",
    "IconHeartbeat": "Vitals",
    "IconActivity": "Activity",
    "IconFirstAidKit": "Emergency",
    "IconAmbulance": "Ambulance",
    "IconWheelchair": "Accessibility",
    "IconBed": "Bed",
    "IconDroplet": "Blood",
    "IconThermometer": "Temperature",
    "IconLungs": "Respiratory",
    "IconBrain": "Neurology",
    "IconBone": "Orthopedics",
    "IconEar": "ENT",
    "IconDental": "Dental",
    "IconBabyCarriage": "Pediatric",
    "IconMoodHappy": "Approve",
    "IconMoodSad": "Reject",
    "IconHandStop": "Stop",
    "IconHandOff": "Release",
    "IconReceipt": "Receipt",
    "IconCash": "Payment",
    "IconCoin": "Currency",
    "IconWallet": "Wallet",
    "IconCreditCard": "Card",
    "IconCalculator": "Calculate",
    "IconPercentage": "Percentage",
    "IconTrendingUp": "Trending up",
    "IconTrendingDown": "Trending down",
    "IconChartBar": "Chart",
    "IconChartLine": "Trend",
    "IconChartPie": "Distribution",
    "IconReport": "Report",
    "IconCloudDownload": "Download from cloud",
    "IconCloudUpload": "Upload to cloud",
    "IconFolderPlus": "New folder",
    "IconFilePlus": "New file",
    "IconFileExport": "Export",
    "IconFileImport": "Import",
    "IconPackage": "Package",
    "IconBox": "Box",
    "IconTruck": "Delivery",
    "IconBuildingHospital": "Hospital",
    "IconBuilding": "Building",
    "IconFlame": "Fire",
    "IconSnowflake": "Cold chain",
    "IconSunrise": "Morning",
    "IconSunset": "Evening",
    "IconMoonStars": "Night",
    "IconDeviceFloppy": "Save",
    "IconPlayerRecord": "Record",
    "IconSquareRoundedX": "Cancel",
    "IconSquareRoundedCheck": "Approve",
    "IconArrowsTransferDown": "Transfer",
    "IconArrowsExchange": "Exchange",
    "IconSwitchHorizontal": "Switch",
    "IconScale": "Legal",
    "IconGavel": "Judgment",
    "IconCertificate": "Certificate",
    "IconAward": "Award",
    "IconMedal": "Medal",
    "IconTrophy": "Achievement",
    "IconSchool": "Learning",
    "IconBook": "Course",
    "IconNotebook": "Notes",
    "IconBallpen": "Write",
    "IconHighlight": "Highlight",
    "IconBlockquote": "Quote",
    "IconLayoutDashboard": "Dashboard",
    "IconApps": "Applications",
    "IconWorld": "Global",
    "IconLanguage": "Language",
    "IconAccessible": "Accessibility",
    "IconGlobe": "Globe",
}


def infer_label_key(icon_name: str) -> str:
    """Infer i18n translation key from icon name."""
    if icon_name in ICON_LABELS:
        # Convert label to dot-case key: "View details" -> "view_details"
        return ICON_LABELS[icon_name].lower().replace(" ", "_")

    # Strip "Icon" prefix and convert camelCase to snake_case
    name = icon_name.replace("Icon", "")
    return re.sub(r"([A-Z])", r"_\1", name).strip("_").lower()


def infer_label(icon_name: str) -> str:
    """Infer English aria-label from icon name."""
    if icon_name in ICON_LABELS:
        return ICON_LABELS[icon_name]

    name = icon_name.replace("Icon", "")
    words = re.sub(r"([A-Z])", r" \1", name).strip()
    return words


def process_file(filepath: str, dry_run: bool = False) -> int:
    """Process a single .tsx file and add missing aria-labels."""
    with open(filepath, "r") as f:
        content = f.read()

    fixes = 0

    # Match the full ActionIcon block: opening tag (possibly multiline) + child icon
    # Captures everything from <ActionIcon to the first <Icon child
    pattern = re.compile(
        r"(<ActionIcon\b)"         # 1: tag start
        r"([\s\S]*?)"              # 2: attributes (greedy-minimal, multiline)
        r"(>)"                     # 3: closing >
        r"(\s*<(Icon\w+)\b)",      # 4: icon element, 5: icon name
    )

    def replacer(match):
        nonlocal fixes
        full = match.group(0)
        attrs = match.group(2)
        icon_name = match.group(5)

        # Skip if aria-label already present
        if "aria-label" in attrs:
            return full

        label = infer_label(icon_name)
        fixes += 1

        # Insert aria-label right before the closing >
        tag_start = match.group(1)
        tag_close = match.group(3)
        icon_part = match.group(4)

        # If attrs ends with newline+spaces (multiline tag), add aria-label on its own line
        stripped = attrs.rstrip()
        trailing = attrs[len(stripped):]
        if "\n" in attrs:
            # Multiline: find indentation level
            lines = attrs.split("\n")
            indent = ""
            for line in lines[1:]:
                if line.strip():
                    indent = re.match(r"^(\s*)", line).group(1)
                    break
            return f'{tag_start}{stripped}\n{indent}aria-label="{label}"{trailing}{tag_close}{icon_part}'

        # Single-line: add before >
        return f'{tag_start}{attrs} aria-label="{label}"{tag_close}{icon_part}'

    content = pattern.sub(replacer, content)

    if fixes > 0 and not dry_run:
        with open(filepath, "w") as f:
            f.write(content)

    return fixes


def main():
    dry_run = "--dry-run" in sys.argv
    web_src = Path(__file__).parent.parent / "apps" / "web" / "src"

    total_fixes = 0
    files_fixed = 0

    for tsx_file in sorted(web_src.rglob("*.tsx")):
        fixes = process_file(str(tsx_file), dry_run)
        if fixes > 0:
            rel = tsx_file.relative_to(web_src)
            action = "would fix" if dry_run else "fixed"
            print(f"  {action} {fixes:3d} aria-labels in {rel}")
            total_fixes += fixes
            files_fixed += 1

    mode = "DRY RUN" if dry_run else "DONE"
    print(f"\n{mode}: {total_fixes} aria-labels {'would be ' if dry_run else ''}added across {files_fixed} files")


if __name__ == "__main__":
    main()
