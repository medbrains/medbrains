/**
 * A quality officer runs the NABH self-assessment for a chapter: creates the
 * checklist for the period, pastes the hospital's criteria, records a
 * finding against each — a gap needs its corrective action — and reads the
 * score the server computes. Next period starts from the same criteria,
 * none of them assessed.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./support/world";

async function createChecklist(page: Page, name: string, copyFrom?: string) {
  await page.getByRole("button", { name: "New checklist" }).click();
  const form = page.getByRole("form", { name: "New checklist" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  await form.getByRole("textbox", { name: "Standard or chapter" }).fill("COP");
  for (const [label, date] of [["Period starts", "April 1, 2026"], ["Period ends", "September 30, 2026"]]) {
    const input = form.getByRole("textbox", { name: label });
    await input.fill(date);
    await input.blur();
  }
  if (copyFrom) {
    await form.getByRole("combobox", { name: "Start from the criteria of" }).click();
    await page.getByRole("option", { name: new RegExp(copyFrom) }).click();
  }
  await form.getByRole("button", { name: "Create checklist" }).click();
  await expect(form).toBeHidden();
}

test("a quality officer assesses a chapter and carries it into the next period", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const { page } = await hospital.newStaff("quality_officer", `Quality Officer ${t}`);
  await page.goto("/regulatory");
  await page.getByRole("tab", { name: "Checklists" }).click();

  await createChecklist(page, `Care of patients ${t}`);
  await page.getByRole("row").filter({ hasText: `Care of patients ${t}` }).getByRole("button", { name: "Open" }).click();
  const drawer = page.getByRole("dialog", { name: `Care of patients ${t}` });
  await expect(drawer.getByText("No criteria yet")).toBeVisible();

  await drawer.getByRole("textbox", { name: "Add criteria" }).fill(
    "Patients are identified with two identifiers\nCare is planned and recorded\nFall risk is assessed on admission",
  );
  await drawer.getByRole("button", { name: "Add 3 criteria" }).click();
  await expect(drawer.getByRole("row")).toHaveCount(4);

  await drawer.getByRole("combobox", { name: "Finding for criterion 1" }).click();
  await page.getByRole("option", { name: "Compliant", exact: true }).click();
  await expect(drawer.getByTestId("checklist-score")).toHaveText("Score 33.33%");

  // Not compliant opens the finding; it is not saved without gap and action.
  await drawer.getByRole("combobox", { name: "Finding for criterion 2" }).click();
  await page.getByRole("option", { name: "Not compliant" }).click();
  const finding = page.getByRole("form", { name: "Assess criterion" });
  await finding.getByRole("button", { name: "Save finding" }).click();
  await expect(finding.getByText("Describe the gap")).toBeVisible();
  await finding.getByRole("textbox", { name: "Gap" }).fill("Care plans unsigned on ward 3");
  await finding.getByRole("textbox", { name: "Corrective action" }).fill("Sign-off at handover, audited weekly");
  await finding.getByRole("button", { name: "Save finding" }).click();
  await expect(finding).toBeHidden();
  await expect(drawer.getByText("Care plans unsigned on ward 3 → Sign-off at handover")).toBeVisible();

  await drawer.getByRole("combobox", { name: "Finding for criterion 3" }).click();
  await page.getByRole("option", { name: "Not applicable" }).click();
  // 1 compliant of 2 applicable.
  await expect(drawer.getByTestId("checklist-score")).toHaveText("Score 50%");
  await drawer.getByRole("button", { name: "Close" }).click();

  // The next period: same criteria, nothing assessed.
  await createChecklist(page, `Care of patients H2 ${t}`, `Care of patients ${t}`);
  await page.getByRole("row").filter({ hasText: `Care of patients H2 ${t}` }).getByRole("button", { name: "Open" }).click();
  const next = page.getByRole("dialog", { name: `Care of patients H2 ${t}` });
  await expect(next.getByRole("row")).toHaveCount(4);
  await expect(next.getByText("Patients are identified with two identifiers")).toBeVisible();
  await expect(next.getByTestId("checklist-score")).toHaveText("Score 0%");
});
