// The MedBrains test report (Allure Report 3, published at https://tests.medbrains.in by the
// nightly E2E run). One report over Playwright, Vitest and the Rust tests, grouped
// app → module → scenario through the epic, feature and story labels that
// `scripts/test_report.py label` fills in where a test does not set them itself.
//
// The colours, fonts and header links are not options here: `test_report.py theme` adds
// them to the generated page. After any Allure upgrade, regenerate the report and attach
// light and dark screenshots to the PR (`node scripts/report-screenshots.mjs`), because the theme
// leans on the report's CSS variable names.
import { defineConfig } from "allure";

export default defineConfig({
  name: "MedBrains tests",
  output: "./allure-report",
  resultsDir: ["./allure-results/playwright", "./allure-results/vitest", "./allure-results/rust"],
  // Carried between nightly runs (downloaded from the published report) for trends and the
  // flaky markers.
  historyPath: "./allure-history/history.jsonl",
  historyLimit: 30,
  // Machine names say nothing to a reader of a public page.
  hideLabels: ["host", "thread", "_fallbackTestCaseId"],
  plugins: {
    awesome: {
      options: {
        reportName: "MedBrains tests",
        logo: "medbrains-mark.svg",
        theme: "auto",
        groupBy: ["epic", "feature", "story"],
      },
    },
  },
});
