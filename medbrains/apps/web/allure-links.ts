// How a test's `issue` and `tms` annotations become links in the Allure report: both name a
// GitHub issue by number. `tms` is the test-scenario issue the test proves, `issue` a bug it
// guards. Shared by the Playwright and Vitest Allure reporters.
const github = "https://github.com/medbrains/medbrains/issues/%s";

export const ALLURE_LINKS = {
  issue: { urlTemplate: github, nameTemplate: "#%s" },
  tms: { urlTemplate: github, nameTemplate: "Scenario #%s" },
};
