import { expect, test } from "@playwright/test";
import { runSteps } from "passmark";
import { ensureAuthenticated } from "../helpers";
import { PASSMARK_SKIP_REASON, passmarkEnabled } from "./guard";

// AI-driven regression test: the Lab → Calculators → anion gap. Synthetic dev tenant only.
// Skipped unless PASSMARK_ENABLED=1 + ANTHROPIC_API_KEY are set (see ./README.md).
test.describe("passmark: Lab clinical calculators", () => {
  test.skip(!passmarkEnabled(), PASSMARK_SKIP_REASON);

  test("anion gap computes a value and acid-base category", async ({ page }) => {
    test.setTimeout(90_000);
    await ensureAuthenticated(page);

    await runSteps({
      page,
      userFlow: "Compute a serum anion gap in the Lab Calculators tab",
      steps: [
        { description: "Open the Laboratory page from the navigation" },
        { description: "Open the Calculators tab" },
        { description: "Set sodium to 140, chloride to 100, and bicarbonate to 10" },
        { description: "Click the Compute anion gap button" },
      ],
      assertions: [
        { assertion: "An anion gap of 30 mmol/L is shown" },
        { assertion: "The category is shown as HIGH" },
      ],
      test,
      expect,
    });
  });
});
