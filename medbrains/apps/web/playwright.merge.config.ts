// Reporters for `playwright merge-reports` in e2e.yml: the CI shards' blobs become one HTML
// report (the artifact) and one JUnit file (the PR's per-test summary).
export default {
  testDir: "./e2e",
  reporter: [
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit/playwright.xml" }],
  ],
};
