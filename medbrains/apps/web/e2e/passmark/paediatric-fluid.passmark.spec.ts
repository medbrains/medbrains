import { expect, test } from "@playwright/test";
import { runSteps } from "passmark";
import { ensureAuthenticated } from "../helpers";
import { PASSMARK_SKIP_REASON, passmarkEnabled } from "./guard";

// AI-driven regression: Care View → Paeds Fluid (Holliday-Segar). Synthetic dev tenant only.
// Skipped unless PASSMARK_ENABLED=1 + ANTHROPIC_API_KEY are set (see ./README.md).
test.describe("passmark: paediatric maintenance fluid", () => {
  test.skip(!passmarkEnabled(), PASSMARK_SKIP_REASON);

  test("computes the 4-2-1 maintenance rate for a 15 kg child", async ({ page }) => {
    test.setTimeout(90_000);
    await ensureAuthenticated(page);

    await runSteps({
      page,
      userFlow: "Compute paediatric maintenance IV fluid in Care View",
      steps: [
        { description: "Open the Care View page from the navigation" },
        { description: "Open the Paeds Fluid tab" },
        { description: "Enter a weight of 15 kg" },
        { description: "Click the Compute maintenance fluid button" },
      ],
      assertions: [
        { assertion: "A maintenance rate of 50 mL/hr is shown" },
        { assertion: "A 24-hour volume of 1250 mL is shown" },
        { assertion: "An isotonic-fluid safety reminder is shown" },
      ],
      test,
      expect,
    });
  });
});
