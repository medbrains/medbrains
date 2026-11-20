// Reporters for `playwright merge-reports` in e2e.yml: the CI shards' blobs become one HTML
// report (the artifact), one JUnit file (the PR's per-test summary) and the Allure results
// the test report at tests.medbrains.in is built from (allurerc.mjs).
//
// A test's `tms` annotation names the test-scenario issue it proves, `issue` a bug it guards;
// both become links to the GitHub issue.
const github = "https://github.com/medbrains/medbrains/issues/%s";

export default {
  testDir: "./e2e",
  reporter: [
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit/playwright.xml" }],
    [
      "allure-playwright",
      {
        resultsDir: "allure-results/playwright",
        links: {
          issue: { urlTemplate: github, nameTemplate: "#%s" },
          tms: { urlTemplate: github, nameTemplate: "Scenario #%s" },
        },
      },
    ],
  ],
};
