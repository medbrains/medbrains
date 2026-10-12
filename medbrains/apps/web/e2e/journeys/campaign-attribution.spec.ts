/**
 * Which campaign brought a patient in, from the ad to the report: marketing
 * creates a campaign with a code, the desk names it when registering, the
 * patient's page says so, and the campaign's report counts the patient —
 * on marketing's own dashboard.
 */
import { api } from "../helpers/api";
import { expect, freshPerson, test } from "./support/world";

const REPORT = "Campaign attribution";

test("a patient registered through a campaign is counted for it", async ({ hospital }) => {
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const campaign = `Knee clinic ${suffix}`;

  // Marketing sets the campaign up.
  const { page: marketing } = await hospital.newStaff("marketing_executive", `Mkt ${suffix}`);
  await marketing.goto("/marketing#campaigns");
  await marketing.getByRole("button", { name: "New campaign" }).click();
  await marketing.getByLabel("Campaign name").fill(campaign);
  await marketing.getByLabel("Source").fill("newspaper");
  await marketing.getByLabel("Campaign code").fill(`knee${suffix}`);
  await marketing.getByRole("button", { name: "Create campaign" }).click();
  await expect(marketing.getByRole("cell", { name: campaign, exact: true })).toBeVisible();

  // The desk registers someone who came because of it.
  const { page: desk } = await hospital.newStaff("receptionist", `Desk ${suffix}`);
  const person = freshPerson();
  await desk.goto("/patients/register");
  await desk.getByLabel("First Name").fill(person.firstName);
  await desk.getByLabel("Last Name").fill(person.lastName);
  await desk.getByLabel(/^Phone \(primary\)/).fill(person.phone);
  await desk.getByLabel("Gender").first().click();
  await desk.getByRole("option", { name: "Female", exact: true }).click();
  await desk.getByLabel("Age years").fill(String(person.ageYears));
  await desk.getByPlaceholder("Select department").click();
  await desk.getByRole("option").first().click();
  await desk.getByRole("combobox", { name: "Came through campaign" }).click();
  await desk.getByRole("option", { name: `${campaign} (KNEE${suffix})` }).click();
  for (let step = 0; step < 4; step += 1) {
    await desk.getByRole("button", { name: "Next", exact: true }).click();
  }
  await desk.getByRole("button", { name: /^register/i }).click();

  // Their page says where they came from.
  const idOf = async () => {
    const list = await api<{ patients: Array<{ id: string; last_name: string }> }>(
      hospital.admin,
      "GET",
      `/api/patients?search=${person.lastName}`,
    );
    return list.patients.find((p) => p.last_name === person.lastName)?.id ?? "";
  };
  await expect.poll(idOf, { timeout: 20_000 }).not.toBe("");
  await desk.goto(`/patients/${await idOf()}`);
  await expect(desk.getByText(`Campaign: ${campaign}`)).toBeVisible();

  // Marketing puts the report on its dashboard and reads the count.
  await marketing.goto("/reports");
  const actions = marketing.getByRole("button", { name: `${REPORT} actions` });
  await expect(actions).toBeVisible({ timeout: 20_000 });
  await actions.click();
  await marketing.getByRole("menuitem", { name: "Add to my dashboard" }).click();
  await marketing.goto("/dashboard");
  await marketing.getByRole("button", { name: `Expand ${REPORT}` }).click();
  const dialog = marketing.getByRole("dialog", { name: REPORT });
  const row = dialog.getByRole("row", { name: new RegExp(campaign) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  // new_patients is the column after campaign and channel.
  await expect(row.getByRole("cell").nth(2)).toHaveText("1");
});
