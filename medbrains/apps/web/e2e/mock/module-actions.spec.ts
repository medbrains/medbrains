import { expect, test, type Page } from "@playwright/test";
import { installMockApi, seedMockSession } from "./mockApi";

function trackPageErrors(page: Page): string[] {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return pageErrors;
}

test.describe("Module Actions (mock)", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedMockSession(page);
  });

  test("care view supports ward workflow interactions", async ({ page }) => {
    const pageErrors = trackPageErrors(page);

    await page.goto("/care-view");

    await page.getByPlaceholder("Filter by ward").click();
    await page.getByRole("option", { name: "ICU" }).click();
    await expect(page.getByText("Ramesh Kumar")).toBeVisible();

    await page.getByRole("button", { name: /Vitals Checklist/i }).click();
    await expect(page.getByRole("table")).toContainText("Ramesh Kumar");

    await page.getByRole("tab", { name: /My Tasks/i }).click();
    await expect(page.getByText("Medications (1)")).toBeVisible();
    await page.getByText("Nursing Tasks (1)").click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Fluid balance review")).toHaveCount(0);

    await page.getByRole("tab", { name: /Handover/i }).click();
    await page.getByPlaceholder("Select shift").click();
    await page.getByRole("option", { name: "Morning" }).click();
    await page.getByRole("button", { name: "Generate Summary" }).click();
    await expect(page.getByText(/ICU.*morning shift/i)).toBeVisible();
    await expect(page.getByText("Repeat lactate")).toBeVisible();

    await page.getByRole("tab", { name: /Discharge Tracker/i }).click();
    await expect(page.getByRole("table")).toContainText("UHID-1001");
    await expect(page.getByText("75%")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("regulatory module supports calendar and submissions workflows", async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    const eventTitle = "Calibration Review Mock";
    const submissionTarget = "State Quality Cell";

    await page.goto("/regulatory");
    await expect(page.getByText("Compliance Dashboard")).toBeVisible();

    await page.getByRole("tab", { name: /Compliance Calendar/i }).click();
    await expect(page.getByRole("heading", { name: "Compliance Calendar" })).toBeVisible();

    await page.getByText("License Alerts", { exact: true }).click();
    await expect(page.getByText("License Renewal Tracking")).toBeVisible();

    await page.getByText("Timeline View", { exact: true }).click();
    await expect(page.getByText("Compliance Calendar Timeline")).toBeVisible();

    await page.getByText("Calendar List", { exact: true }).click();
    await page.getByRole("button", { name: "New Event" }).click();
    await expect(page.getByRole("dialog")).toContainText("New Calendar Event");
    await page.getByLabel("Title").fill(eventTitle);
    await page.getByLabel("Due Date").fill("2026-05-12");
    await page.getByRole("button", { name: "Create Event" }).click();
    await expect(page.getByRole("main").getByRole("table").first()).toContainText(eventTitle);

    await page.getByRole("tab", { name: /Submissions/i }).click();
    await page.getByRole("button", { name: "New Submission" }).click();
    const submissionDialog = page.getByRole("dialog").filter({ hasText: "New Regulatory Submission" });
    await expect(submissionDialog).toBeVisible();
    await submissionDialog.getByRole("combobox", { name: "Submission Type" }).click();
    await page.getByRole("option", { name: "annual_report" }).click();
    await submissionDialog.getByLabel("Submitted To").fill(submissionTarget);
    await submissionDialog.getByLabel("Reference Number").fill("SUB-2026-77");
    await submissionDialog.getByRole("button", { name: "Save Submission" }).click();
    await expect(page.getByRole("table")).toContainText(submissionTarget);

    expect(pageErrors).toEqual([]);
  });

  test("analytics module supports tab and view switching", async ({ page }) => {
    const pageErrors = trackPageErrors(page);

    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics & Dashboards" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Cardiology")).toBeVisible();

    await page.getByText("By Doctor", { exact: true }).click();
    await expect(page.getByRole("table").getByText("Dr. Mehta")).toBeVisible();

    await page.getByRole("tab", { name: /IPD Census/i }).click();
    await expect(page.getByText("IPD Census Trend")).toBeVisible();

    await page.getByRole("tab", { name: /Lab TAT/i }).click();
    await expect(page.getByText("Top 10 Tests by Avg TAT")).toBeVisible();
    await expect(page.getByRole("table").getByText("CBC")).toBeVisible();

    await page.getByRole("tab", { name: /Clinical/i }).click();
    await page.getByText("ER Volume", { exact: true }).click();
    await expect(page.getByText("ER Volume by Triage Level")).toBeVisible();
    await page.getByText("Clinical Indicators", { exact: true }).click();
    await expect(page.getByText("Clinical Indicator Trends")).toBeVisible();

    await page.getByRole("tab", { name: /OPD & Beds/i }).click();
    await page.getByText("Bed Occupancy", { exact: true }).click();
    await expect(page.getByText("Ward Occupancy")).toBeVisible();
    await expect(page.getByText("Overall Occupancy")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("devices module supports catalog, routing, and add-device flows", async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    const routingRuleName = "ICU monitor -> vitals";
    const deviceName = "Mock CT Unit 3";

    await page.goto("/admin/devices");
    await expect(page.getByText("CT Room 1")).toBeVisible();

    await page.getByRole("tab", { name: "Adapter Catalog" }).click();
    await page.getByPlaceholder("Search adapters...").fill("GE");
    await expect(page.getByText("Revolution ACT")).toBeVisible();

    await page.getByRole("tab", { name: "Routing Rules" }).click();
    await expect(page.getByText("CT -> Radiology Worklist")).toBeVisible();
    await page.getByRole("button", { name: "Add Rule" }).click();
    await expect(page.getByRole("dialog")).toContainText("Add Routing Rule");
    await page.getByLabel("Rule name").fill(routingRuleName);
    await page.getByRole("combobox", { name: "Target module" }).click();
    await page.getByRole("option", { name: "Vitals" }).click();
    await page.getByLabel("Match field path").fill("OBX.3");
    await page.getByLabel("Target entity").fill("icu_flowsheets");
    await page.getByRole("button", { name: "Create Rule" }).click();
    const routingRow = page.locator("tr", { hasText: routingRuleName });
    await expect(routingRow).toBeVisible();
    await routingRow.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: routingRuleName })).toHaveCount(0);

    await page.getByRole("tab", { name: "Bridge Agents" }).click();
    await expect(page.getByText("Bridge Agent A")).toBeVisible();

    await page.getByRole("tab", { name: "Connected Devices" }).click();
    await page.getByRole("button", { name: "Add Device" }).click();
    const deviceDialog = page.getByRole("dialog").filter({ hasText: "Add Device" });
    await expect(deviceDialog).toBeVisible();
    await deviceDialog.getByPlaceholder("Search by manufacturer or model...").fill("GE");
    await expect(deviceDialog.getByText("Revolution ACT", { exact: true })).toBeVisible();
    await deviceDialog.getByText("Revolution ACT", { exact: true }).click();
    await expect(deviceDialog.getByText(/auto-configured/i)).toBeVisible();
    await deviceDialog.getByRole("button", { name: "Continue" }).click();
    await deviceDialog.getByLabel("Device name").fill(deviceName);
    await deviceDialog.getByLabel("Device code").fill("CT-ROOM-3");
    await deviceDialog.getByLabel("Hostname / IP").fill("10.20.40.12");
    await deviceDialog.getByRole("button", { name: "Save Device" }).click();
    await expect(page.getByText(deviceName)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
