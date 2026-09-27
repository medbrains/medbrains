/**
 * The registration rules the desk meets, on the web — the same rules the
 * server and both native apps ask (crates/medbrains-clinical-core/src/
 * registration). Each case is a click-through by a receptionist; the record
 * the server kept is read back through the API.
 */
import { api } from "../helpers/api";
import { RegistrationDesk } from "./pages/registration-desk";
import { expect, freshPerson, test } from "./support/world";

interface PatientRecord {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  attributes?: Record<string, unknown>;
}

async function record(ctx: Parameters<typeof api>[0], firstName: string): Promise<PatientRecord | undefined> {
  const page = await api<{ patients: PatientRecord[] }>(ctx, "GET", `/api/patients?search=${firstName}&per_page=5`);
  return page.patients.find((p) => p.first_name === firstName);
}

test("a patient with a single name and no phone is registered as they are", async ({ hospital }) => {
  test.setTimeout(120_000);
  const dept = await hospital.department("Rules OPD");
  // No phone and no last name to find them by, so one long unique name:
  // a two-syllable first name alone repeats across runs.
  const fresh = freshPerson();
  const person = { ...fresh, firstName: `${fresh.firstName}${fresh.lastName.toLowerCase()}` };
  const desk = new RegistrationDesk(await hospital.as("receptionist"));
  await desk.open();
  await desk.register({ ...person, lastName: "", hasNoPhone: true, sex: "Female", department: dept.name });
  await expect.poll(async () => (await record(hospital.admin, person.firstName))?.id ?? "").not.toBe("");

  const kept = await record(hospital.admin, person.firstName);
  expect(kept?.last_name, "one name is a whole name").toBe("");
  expect(kept?.phone, "no invented number").toBe("");
  const full = await api<{ attributes?: Record<string, unknown> } & { patient?: { attributes?: Record<string, unknown> } }>(
    hospital.admin,
    "GET",
    `/api/patients/${kept?.id}`,
  );
  const attributes = full.patient?.attributes ?? full.attributes;
  expect(attributes?.has_no_phone, "the record says so").toBe(true);
});

test("the desk is told to choose a sex and to give a phone or say there is none", async ({ hospital }) => {
  const page = await hospital.as("receptionist");
  await page.goto("/patients/register");
  await page.getByTestId("field-first_name").fill(freshPerson().firstName);
  await page.getByTestId("field-age_years").fill("40");
  await page.getByTestId("btn-next").click();
  // The shared rules' own words.
  await expect(page.getByText("Choose the patient's sex")).toBeVisible();
  await expect(page.getByText("Enter a phone number, or tick Has no phone")).toBeVisible();
});
