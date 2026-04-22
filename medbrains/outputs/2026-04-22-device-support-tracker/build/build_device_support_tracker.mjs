import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = "/Users/apple/Projects/MedBrains";
const OUTPUT_DIR = path.join(ROOT, "medbrains", "outputs", "2026-04-22-device-support-tracker");
const SOURCE_JSON = path.join(OUTPUT_DIR, "device_support_tracker_source.json");
const OUTPUT_XLSX = path.join(OUTPUT_DIR, "MedBrains_Supported_Devices_Tracker.xlsx");

const source = JSON.parse(await fs.readFile(SOURCE_JSON, "utf8"));
const workbook = Workbook.create();

const headerFormat = {
  fill: "#1D4ED8",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

const sectionFormat = {
  fill: "#DBEAFE",
  font: { bold: true, color: "#1E3A8A" },
};

const titleFormat = {
  font: { bold: true, color: "#0F172A", size: 16 },
  verticalAlignment: "center",
};

const subtitleFormat = {
  font: { color: "#475569", size: 10 },
};

const supportFill = {
  Configurable: "#DCFCE7",
  Partial: "#FEF3C7",
  Planned: "#DBEAFE",
  Research: "#FEE2E2",
};

const supportFont = {
  Configurable: "#166534",
  Partial: "#92400E",
  Planned: "#1D4ED8",
  Research: "#B91C1C",
};

function escapeSheetName(name) {
  return `'${name.replaceAll("'", "''")}'`;
}

function asText(value) {
  return value == null ? "" : String(value);
}

function setColumnWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

function addSummarySheet() {
  const sheet = workbook.worksheets.add("Summary");
  sheet.showGridLines = false;

  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [["MedBrains Supported Devices Tracker"]];
  sheet.getRange("A1").format = titleFormat;

  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[`Generated ${source.generated_at} • Seeded from MedBrains_Features.xlsx hardware-related rows`]];
  sheet.getRange("A2").format = subtitleFormat;

  sheet.getRange("A4:B8").values = [
    ["Metric", "Value"],
    ["Hardware-related features", source.total_hardware_features],
    ["Registry entries", source.registry_entry_count],
    ["Protocol patterns", source.protocol_patterns.length],
    ["Manual intake rows", source.manual_intake_rows.length],
  ];
  sheet.getRange("A4:B4").format = headerFormat;

  sheet.getRange("D4:E4").values = [["Support Status", "Count"]];
  sheet.getRange("D4:E4").format = headerFormat;
  const statuses = ["Configurable", "Partial", "Planned", "Research"];
  sheet.getRange("D5:D8").values = statuses.map((status) => [status]);
  sheet.getRange("E5:E8").values = statuses.map((status) => [source.support_status_counts[status] ?? 0]);

  const domainRows = Object.entries(source.domain_counts).sort((a, b) => b[1] - a[1]);
  const domainEndRow = 11 + domainRows.length;
  sheet.getRange("A11:B11").values = [["Domain", "Registry Entries"]];
  sheet.getRange("A11:B11").format = headerFormat;
  if (domainRows.length > 0) {
    sheet.getRange(`A12:B${domainEndRow}`).values = domainRows.map(([domain, count]) => [domain, count]);
  }

  sheet.getRange("D11:H11").merge();
  sheet.getRange("D11").values = [["Why this workbook exists"]];
  sheet.getRange("D11").format = sectionFormat;
  sheet.getRange("D12:H18").values = [[
    "Real hospital devices are rarely blocked by UI work alone. They usually need protocol discovery, vendor manuals, adapters, and a no-hardware fallback. This tracker keeps those streams visible so we can build software-first flows continuously.",
  ]];
  sheet.getRange("D12:H18").format.wrapText = true;
  sheet.getRange("D12:H18").format.verticalAlignment = "top";

  const statusChart = sheet.charts.add("bar", {
    from: { row: 3, col: 9 },
    extent: { widthPx: 420, heightPx: 250 },
  });
  statusChart.title = "Support Status Mix";
  statusChart.hasLegend = false;
  statusChart.barOptions.direction = "column";
  statusChart.barOptions.grouping = "clustered";
  const summaryRef = escapeSheetName(sheet.name);
  const series = statusChart.series.add("Count");
  series.categoryFormula = `${summaryRef}!$D$5:$D$8`;
  series.formula = `${summaryRef}!$E$5:$E$8`;
  statusChart.setPosition("J4", "O18");

  setColumnWidths(sheet, {
    A: 24,
    B: 14,
    C: 4,
    D: 20,
    E: 12,
    F: 18,
    G: 18,
    H: 18,
    I: 4,
    J: 16,
    K: 16,
    L: 16,
    M: 16,
    N: 16,
    O: 16,
  });
  sheet.getRange("1:18").format.rowHeight = 22;
  sheet.getRange("12:18").format.rowHeight = 34;
}

function addRegistrySheet() {
  const sheet = workbook.worksheets.add("Device Registry");
  sheet.showGridLines = false;
  const header = [
    "Domain",
    "Device Family",
    "Support Status",
    "Priority",
    "Feature Count",
    "Done",
    "Partial",
    "Pending",
    "Interaction Mode",
    "Protocols",
    "Integration Pattern",
    "Config Inputs",
    "Fallback Strategy",
    "Simulator Strategy",
    "AI Assist",
    "Related Modules",
    "Next Build Step",
  ];
  sheet.getRange("A1:Q1").values = [header];
  sheet.getRange("A1:Q1").format = headerFormat;
  const endRow = 1 + source.registry_entries.length;
  if (source.registry_entries.length > 0) {
    sheet.getRange(`A2:Q${endRow}`).values = source.registry_entries.map((entry) => [
      entry.domain,
      entry.device_family,
      entry.support_status,
      entry.priority,
      entry.feature_count,
      entry.done_count,
      entry.partial_count,
      entry.pending_count,
      entry.interaction_mode,
      entry.protocols,
      entry.integration_pattern,
      entry.config_inputs,
      entry.fallback_strategy,
      entry.simulator_strategy,
      entry.ai_assist,
      entry.related_modules,
      entry.next_build_step,
    ]);
    for (let row = 2; row <= endRow; row += 1) {
      const value = sheet.getRange(`C${row}`).values?.[0]?.[0] ?? source.registry_entries[row - 2].support_status;
      sheet.getRange(`C${row}`).format = {
        fill: supportFill[value] ?? "#E2E8F0",
        font: { bold: true, color: supportFont[value] ?? "#0F172A" },
        horizontalAlignment: "center",
      };
    }
    sheet.getRange(`A2:Q${endRow}`).format.wrapText = true;
    sheet.getRange(`A1:Q${endRow}`).format.verticalAlignment = "center";
    sheet.getRange(`1:${endRow}`).format.rowHeight = 30;
  }
  setColumnWidths(sheet, {
    A: 18,
    B: 24,
    C: 14,
    D: 8,
    E: 12,
    F: 8,
    G: 8,
    H: 8,
    I: 26,
    J: 22,
    K: 22,
    L: 24,
    M: 24,
    N: 24,
    O: 24,
    P: 20,
    Q: 26,
  });
}

function addProtocolSheet() {
  const sheet = workbook.worksheets.add("Protocol Patterns");
  sheet.showGridLines = false;
  const header = [
    "Protocol Family",
    "Used For",
    "Transport",
    "Real Interaction",
    "Configuration Surface",
    "Manual Artifacts",
    "No-Hardware Fallback",
  ];
  sheet.getRange("A1:G1").values = [header];
  sheet.getRange("A1:G1").format = headerFormat;
  const endRow = 1 + source.protocol_patterns.length;
  sheet.getRange(`A2:G${endRow}`).values = source.protocol_patterns.map((row) => [
    row.protocol_family,
    row.used_for,
    row.transport,
    row.real_interaction,
    row.configuration_surface,
    row.manual_artifacts,
    row.no_hardware_fallback,
  ]);
  sheet.getRange(`A2:G${endRow}`).format.wrapText = true;
  sheet.getRange(`A1:G${endRow}`).format.verticalAlignment = "center";
  sheet.getRange(`1:${endRow}`).format.rowHeight = 28;
  setColumnWidths(sheet, {
    A: 20,
    B: 30,
    C: 16,
    D: 34,
    E: 30,
    F: 32,
    G: 28,
  });
}

function addManualIntakeSheet() {
  const sheet = workbook.worksheets.add("Manual Intake");
  sheet.showGridLines = false;
  const header = [
    "Tracker ID",
    "Domain",
    "Device Family",
    "Target Vendor",
    "Target Model",
    "Manual Link",
    "Protocol Verified",
    "Sample Payload Available",
    "SDK/Driver Captured",
    "Simulator Ready",
    "Owner",
    "Notes",
  ];
  sheet.getRange("A1:L1").values = [header];
  sheet.getRange("A1:L1").format = headerFormat;
  const endRow = 1 + source.manual_intake_rows.length;
  sheet.getRange(`A2:L${endRow}`).values = source.manual_intake_rows.map((row) => [
    row.tracker_id,
    row.domain,
    row.device_family,
    row.target_vendor,
    row.target_model,
    row.manual_link,
    row.protocol_verified,
    row.sample_payload_available,
    row.sdk_or_driver_captured,
    row.simulator_ready,
    row.owner,
    row.notes,
  ]);
  sheet.getRange(`A2:L${endRow}`).format.wrapText = true;
  sheet.getRange(`A1:L${endRow}`).format.verticalAlignment = "center";
  sheet.getRange(`1:${endRow}`).format.rowHeight = 26;
  setColumnWidths(sheet, {
    A: 12,
    B: 18,
    C: 24,
    D: 18,
    E: 18,
    F: 34,
    G: 12,
    H: 18,
    I: 18,
    J: 14,
    K: 14,
    L: 34,
  });
}

function addFeatureMappingSheet() {
  const sheet = workbook.worksheets.add("Feature Mapping");
  sheet.showGridLines = false;
  const header = [
    "Sheet",
    "Module",
    "Sub-Module",
    "Feature",
    "Priority",
    "Product Status",
    "Web",
    "Mobile",
    "TV",
    "Domain",
    "Device Family",
    "Protocols",
    "Integration Pattern",
    "Fallback Strategy",
    "Next Build Step",
  ];
  sheet.getRange("A1:O1").values = [header];
  sheet.getRange("A1:O1").format = headerFormat;
  const endRow = 1 + source.feature_rows.length;
  sheet.getRange(`A2:O${endRow}`).values = source.feature_rows.map((row) => [
    row.sheet,
    row.module,
    row.sub_module,
    row.feature,
    row.priority,
    row.product_status,
    row.web,
    row.mobile,
    row.tv,
    row.domain,
    row.device_family,
    row.protocols,
    row.integration_pattern,
    row.fallback_strategy,
    row.next_build_step,
  ]);
  sheet.getRange(`A2:O${endRow}`).format.wrapText = true;
  sheet.getRange(`A1:O${endRow}`).format.verticalAlignment = "center";
  sheet.getRange(`1:${endRow}`).format.rowHeight = 22;
  setColumnWidths(sheet, {
    A: 18,
    B: 18,
    C: 20,
    D: 44,
    E: 8,
    F: 12,
    G: 8,
    H: 8,
    I: 8,
    J: 22,
    K: 24,
    L: 20,
    M: 24,
    N: 24,
    O: 24,
  });
}

function addDomainSheet(domainSheet) {
  const sheet = workbook.worksheets.add(domainSheet.name.slice(0, 31));
  sheet.showGridLines = false;
  sheet.getRange("A1:J1").merge();
  sheet.getRange("A1").values = [[domainSheet.name]];
  sheet.getRange("A1").format = titleFormat;
  sheet.getRange("A2:J2").merge();
  sheet.getRange("A2").values = [["Seeded from the main feature tracker; use this as the ongoing backlog for real device enablement and fallback design."]];
  sheet.getRange("A2").format = subtitleFormat;
  const header = [
    "Module",
    "Sub-Module",
    "Feature",
    "Priority",
    "Product Status",
    "Device Family",
    "Protocols",
    "Manual Checklist",
    "Simulator Strategy",
    "AI Assist",
  ];
  sheet.getRange("A4:J4").values = [header];
  sheet.getRange("A4:J4").format = headerFormat;
  const endRow = 4 + domainSheet.rows.length;
  if (domainSheet.rows.length > 0) {
    sheet.getRange(`A5:J${endRow}`).values = domainSheet.rows.map((row) => [
      row.module,
      row.sub_module,
      row.feature,
      row.priority,
      row.product_status,
      row.device_family,
      row.protocols,
      row.manual_checklist,
      row.simulator_strategy,
      row.ai_assist,
    ]);
    sheet.getRange(`A5:J${endRow}`).format.wrapText = true;
    sheet.getRange(`A1:J${endRow}`).format.verticalAlignment = "center";
    sheet.getRange(`1:${endRow}`).format.rowHeight = 24;
  }
  setColumnWidths(sheet, {
    A: 18,
    B: 20,
    C: 42,
    D: 8,
    E: 12,
    F: 24,
    G: 20,
    H: 28,
    I: 24,
    J: 24,
  });
}

addSummarySheet();
addRegistrySheet();
addProtocolSheet();
addManualIntakeSheet();
addFeatureMappingSheet();
for (const domainSheet of source.domain_sheets) {
  addDomainSheet(domainSheet);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_XLSX);

let inspectSummary = "";
try {
  const check = await workbook.inspect({
    kind: "table",
    range: "Summary!A1:H18",
    include: "values",
    tableMaxRows: 18,
    tableMaxCols: 8,
  });
  inspectSummary = check.ndjson ?? "";
} catch (error) {
  inspectSummary = `inspect unavailable: ${error}`;
}

await fs.writeFile(path.join(OUTPUT_DIR, "build_inspect_summary.txt"), inspectSummary, "utf8");
console.log(`Saved ${OUTPUT_XLSX}`);
