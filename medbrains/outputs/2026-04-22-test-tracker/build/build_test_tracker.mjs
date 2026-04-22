import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = "/Users/apple/Projects/MedBrains";
const OUTPUT_DIR = path.join(ROOT, "medbrains", "outputs", "2026-04-22-test-tracker");
const SOURCE_JSON = path.join(OUTPUT_DIR, "test_tracker_source.json");
const OUTPUT_XLSX = path.join(OUTPUT_DIR, "MedBrains_Test_Tracker.xlsx");

const raw = await fs.readFile(SOURCE_JSON, "utf8");
const source = JSON.parse(raw);

const workbook = Workbook.create();

const statusColors = {
  Done: "#DCFCE7",
  "In Progress": "#FEF3C7",
  Planned: "#DBEAFE",
  Blocked: "#FEE2E2",
};

const statusFontColors = {
  Done: "#166534",
  "In Progress": "#92400E",
  Planned: "#1D4ED8",
  Blocked: "#B91C1C",
};

const headerFormat = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

const titleFormat = {
  font: { bold: true, color: "#0F172A", size: 16 },
  verticalAlignment: "center",
};

const subtitleFormat = {
  font: { color: "#475569", size: 10 },
};

function escapeSheetName(name) {
  return `'${name.replaceAll("'", "''")}'`;
}

function asText(value) {
  return value == null ? "" : String(value);
}

function setColumnWidths(sheet) {
  const widths = {
    A: 8,
    B: 18,
    C: 18,
    D: 54,
    E: 14,
    F: 10,
    G: 14,
    H: 12,
    I: 8,
    J: 8,
    K: 8,
    L: 22,
    M: 28,
    N: 14,
    O: 34,
    P: 34,
  };

  for (const [col, width] of Object.entries(widths)) {
    sheet.getRange(`${col}:${col}`).format.columnWidth = width;
  }
}

function addSummarySheet() {
  const sheet = workbook.worksheets.add("Summary");
  sheet.showGridLines = false;
  const coverageEndRow = 11 + source.current_coverage.length;

  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1").values = [["MedBrains Test Tracker"]];
  sheet.getRange("A1").format = titleFormat;

  sheet.getRange("A2:F2").merge();
  sheet.getRange("A2").values = [[`Generated ${source.generated_at} • Mirrors MedBrains_Features.xlsx structure`]];
  sheet.getRange("A2").format = subtitleFormat;

  sheet.getRange("A4:B8").values = [
    ["Metric", "Value"],
    ["Total Features", source.total_features],
    [
      "Ready for Test Authoring",
      (source.product_status_counts.Done ?? 0) + (source.product_status_counts.Partial ?? 0),
    ],
    ["Blocked by Feature Build", source.total_features - ((source.product_status_counts.Done ?? 0) + (source.product_status_counts.Partial ?? 0))],
    ["Seeded Coverage Items", source.current_coverage.length],
  ];
  sheet.getRange("A4:B4").format = headerFormat;
  sheet.getRange("A4:B8").format.wrapText = true;

  sheet.getRange("D4:E4").values = [["Test Status", "Count"]];
  sheet.getRange("D4:E4").format = headerFormat;
  sheet.getRange("D5:D8").values = [
    ["Done"],
    ["In Progress"],
    ["Planned"],
    ["Blocked"],
  ];

  sheet.getRange("E5:E8").values = [[
    source.test_status_counts.Done ?? 0,
  ], [
    source.test_status_counts["In Progress"] ?? 0,
  ], [
    source.test_status_counts.Planned ?? 0,
  ], [
    source.test_status_counts.Blocked ?? 0,
  ]];

  sheet.getRange("A10:E10").merge();
  sheet.getRange("A10").values = [["Current Coverage Seed"]];
  sheet.getRange("A10").format = headerFormat;

  sheet.getRange("A11:E11").values = [["Area", "Module", "Test Name", "Status", "Notes"]];
  sheet.getRange("A11:E11").format = headerFormat;
  sheet.getRange(`A12:E${coverageEndRow}`).values = source.current_coverage.map((item) => [
    item.area,
    item.module,
    item.test_name,
    item.status,
    item.notes,
  ]);
  sheet.getRange(`A12:E${coverageEndRow}`).format.wrapText = true;

  const chart = sheet.charts.add("bar", {
    from: { row: 3, col: 6 },
    extent: { widthPx: 440, heightPx: 260 },
  });
  chart.title = "Tracker Status Mix";
  chart.hasLegend = false;
  chart.barOptions.direction = "column";
  chart.barOptions.grouping = "clustered";
  const ref = escapeSheetName(sheet.name);
  const series = chart.series.add("Count");
  series.categoryFormula = `${ref}!$D$5:$D$8`;
  series.formula = `${ref}!$E$5:$E$8`;
  chart.setPosition("G4", "L18");

  sheet.getRange(`A1:L${Math.max(20, coverageEndRow)}`).format.wrapText = true;
  sheet.getRange(`A1:L${Math.max(20, coverageEndRow)}`).format.verticalAlignment = "center";
  sheet.getRange("C:C").format.columnWidth = 34;
  sheet.getRange("E:E").format.columnWidth = 44;
  sheet.getRange(`1:${Math.max(20, coverageEndRow)}`).format.rowHeight = 22;
  sheet.getRange("1:2").format.rowHeight = 26;
  sheet.getRange("10:11").format.rowHeight = 24;
}

function addCategorySheet(sheetData) {
  const sheet = workbook.worksheets.add(sheetData.name);
  sheet.showGridLines = false;

  const headerRow = [
    "S.No",
    "Module",
    "Sub-Module",
    "Feature",
    "Source",
    "Priority",
    "Product Status",
    "RFC Ref",
    "Web",
    "Mobile",
    "TV",
    "Test Layer",
    "Test Scope",
    "Test Status",
    "Existing Coverage",
    "Next Action",
  ];

  sheet.getRange("A1:P1").values = [headerRow];
  sheet.getRange("A1:P1").format = headerFormat;
  setColumnWidths(sheet);

  let rowNumber = 2;
  for (const row of sheetData.rows) {
    if (row.row_type === "module_header") {
      sheet.getRange(`A${rowNumber}:P${rowNumber}`).merge();
      sheet.getRange(`A${rowNumber}`).values = [[row.label]];
      sheet.getRange(`A${rowNumber}`).format = {
        fill: "#D6E4F0",
        font: { bold: true, color: "#0F172A" },
      };
      rowNumber += 1;
      continue;
    }

    if (row.row_type === "submodule_header") {
      sheet.getRange(`A${rowNumber}:P${rowNumber}`).merge();
      sheet.getRange(`A${rowNumber}`).values = [[row.label]];
      sheet.getRange(`A${rowNumber}`).format = {
        fill: "#E9EFF7",
        font: { bold: true, color: "#334155" },
      };
      rowNumber += 1;
      continue;
    }

    sheet.getRange(`A${rowNumber}:P${rowNumber}`).values = [[
      row.s_no,
      asText(row.module),
      asText(row.sub_module),
      asText(row.feature),
      asText(row.source),
      asText(row.priority),
      row.product_status,
      asText(row.rfc_ref),
      asText(row.web),
      asText(row.mobile),
      asText(row.tv),
      row.test_layer,
      row.test_scope,
      row.test_status,
      row.existing_coverage,
      row.next_action,
    ]];

    sheet.getRange(`A${rowNumber}:P${rowNumber}`).format.wrapText = true;
    const statusRange = sheet.getRange(`N${rowNumber}`);
    statusRange.format = {
      fill: statusColors[row.test_status] ?? "#E2E8F0",
      font: { bold: true, color: statusFontColors[row.test_status] ?? "#0F172A" },
      horizontalAlignment: "center",
    };
    const productStatusRange = sheet.getRange(`G${rowNumber}`);
    productStatusRange.format = {
      fill: statusColors[row.product_status] ?? "#F8FAFC",
      font: { color: statusFontColors[row.product_status] ?? "#334155" },
      horizontalAlignment: "center",
    };
    rowNumber += 1;
  }

  const lastRow = rowNumber - 1;
  if (lastRow >= 2) {
    sheet.getRange(`A1:P${lastRow}`).format.verticalAlignment = "center";
    sheet.getRange(`1:${lastRow}`).format.rowHeight = 20;
    sheet.getRange("1:1").format.rowHeight = 24;
  }
}

addSummarySheet();
for (const sheetData of source.sheets) {
  addCategorySheet(sheetData);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const out = await SpreadsheetFile.exportXlsx(workbook);
await out.save(OUTPUT_XLSX);

console.log(`Saved ${OUTPUT_XLSX}`);
