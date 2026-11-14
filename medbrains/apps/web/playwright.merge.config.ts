// Reporters for `playwright merge-reports` in e2e.yml: the CI shards' blobs become one HTML
// report (the artifact), one JUnit file (the PR's per-test summary) and the Allure results
// the test report at tests.medbrains.in is built from (allurerc.mjs).
import { ALLURE_LINKS } from "./allure-links.ts";

export default {
  testDir: "./e2e",
  reporter: [
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit/playwright.xml" }],
    ["allure-playwright", { resultsDir: "allure-results/playwright", links: ALLURE_LINKS }],
  ],
};
