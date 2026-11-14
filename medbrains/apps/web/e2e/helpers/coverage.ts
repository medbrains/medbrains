/**
 * Browser coverage for SonarCloud. With E2E_COVERAGE=1 (the CI shards in e2e.yml) each page a
 * journey opens records Chromium's V8 coverage; the global teardown turns it into an LCOV
 * report of the app's own source, which sonarqube.yml merges with the Vitest report.
 * Off by default: locally nothing is recorded.
 */
import type { Page } from "@playwright/test";
import MCR, { type CoverageReportOptions } from "monocart-coverage-reports";

export const isCoverageOn = process.env.E2E_COVERAGE === "1";

const options: CoverageReportOptions = {
  name: "E2E browser coverage",
  outputDir: "coverage/e2e",
  reports: [["lcov", { file: "lcov.info" }]],
  // The app's TypeScript as the Vite dev server serves it; not dependencies, Vite's client,
  // stylesheets or SVG components.
  entryFilter: (entry) => /^\/src\/.*\.tsx?$/.test(new URL(entry.url).pathname),
  // Source-mapped back to the files. A module arrives as `<host>-<port>/src/...`; the original
  // it maps to arrives by bare name (`App.tsx`) beside it. SonarCloud matches paths from the
  // repository root.
  sourcePath: (filePath, info) => {
    const full =
      !filePath.includes("/") && info?.distFile
        ? `${String(info.distFile).replace(/[^/]*$/, "")}${filePath}`
        : filePath;
    return full.replace(/^.*?\/src\//, "medbrains/apps/web/src/");
  },
};

/** Starts recording a page's coverage when E2E_COVERAGE=1. */
export async function startCoverage(page: Page): Promise<void> {
  if (isCoverageOn) await page.coverage.startJSCoverage({ resetOnNavigation: false });
}

/** Stops recording and stores what the page ran, before its context closes. */
export async function saveCoverage(page: Page): Promise<void> {
  if (!isCoverageOn || page.isClosed()) return;
  await MCR(options).add(await page.coverage.stopJSCoverage());
}

/** Writes the LCOV report from every page stored in this run (global teardown). */
export async function writeCoverageReport(): Promise<void> {
  if (isCoverageOn) await MCR(options).generate();
}
