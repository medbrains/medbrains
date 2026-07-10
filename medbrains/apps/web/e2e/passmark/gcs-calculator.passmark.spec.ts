import { expect, test } from "@playwright/test";
import { runSteps } from "passmark";
import { ensureAuthenticated } from "../helpers";
import { PASSMARK_SKIP_REASON, passmarkEnabled } from "./guard";

// Example AI-driven regression test: the Care View → GCS calculator. Synthetic dev tenant only.
// Skipped unless PASSMARK_ENABLED=1 + ANTHROPIC_API_KEY are set (see ./README.md).
test.describe("passmark: Care View clinical calculators", () => {
  test.skip(!passmarkEnabled(), PASSMARK_SKIP_REASON);

  test("GCS calculator computes a total and severity band", async ({ page }) => {
    test.setTimeout(90_000);
    await ensureAuthenticated(page);

    await runSteps({
      page,
      userFlow: "Compute a Glasgow Coma Scale score in Care View",
      steps: [
        { description: "Open the Care View page from the navigation" },
        { description: "Open the GCS tab" },
        { description: "Set eye opening to 3, verbal response to 4, and motor response to 5" },
        { description: "Click the Compute GCS button" },
      ],
      assertions: [
        { assertion: "A total GCS score of 12 out of 15 is shown" },
        { assertion: "The severity is shown as MODERATE" },
      ],
      test,
      expect,
    });
  });
});
