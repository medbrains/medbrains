/**
 * A patient manages their own privacy from the portal (DPDP Act s.6(4),
 * s.11-14): reads the notice in Tamil, agrees to health reminders, sees what
 * the hospital holds about them, and asks for their data to be corrected —
 * the request reaches the privacy officer's register, due in 90 days.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { latestPortalCode } from "../helpers/patient-sms";
import { expect, test } from "./support/world";

test("a patient sets their privacy choices and makes a request from the portal", async ({ hospital }) => {
  test.setTimeout(90_000);
  const admin = hospital.admin;
  const tenant = await api<{ code: string }>(admin, "GET", "/api/setup/tenant");
  const phone = `9${String(Date.now()).slice(-9)}`;
  const patient = await createPatientApi(admin, { phone, lastName: `Portal${Date.now().toString(36)}` });

  const portal = await hospital.asPublic();
  await portal.goto(`/portal/${tenant.code}`);
  await portal.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await portal.getByRole("button", { name: "Send code" }).click();
  await portal.getByRole("textbox", { name: "Code" }).fill(latestPortalCode(phone));
  await portal.getByRole("button", { name: "Sign in" }).click();
  await portal.getByRole("tab", { name: "Privacy" }).click();

  const consent = portal.getByTestId("portal-consent");
  const save = consent.getByRole("button", { name: "Save my choices" });
  await expect(save).toBeDisabled();
  await consent.getByText("தமிழ்", { exact: true }).click();
  await consent.getByLabel(/மறு வருகை/).check();
  await save.click();
  await expect(save).toBeDisabled();
  const saved = await api<{ history: Array<{ purposes: string[]; source: string; notice_language: string }> }>(
    admin,
    "GET",
    `/api/patients/${patient.id}/dpdp-consent`,
  );
  expect(saved.history[0]).toMatchObject({ purposes: ["health_reminders"], source: "portal", notice_language: "ta" });

  await expect(portal.getByTestId("portal-held")).toContainText("What the hospital holds about you");

  const requests = portal.getByTestId("portal-requests");
  await requests.getByRole("button", { name: "Make a request" }).click();
  const form = portal.getByRole("form", { name: "New privacy request" });
  await form.getByRole("combobox", { name: "I want to" }).click();
  await portal.getByRole("option", { name: "Correct or complete their data" }).click();
  await form.getByRole("textbox", { name: "Tell us more" }).fill("My date of birth is wrong");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(requests).toContainText("Answer due within");

  const register = await api<Array<{ received_via: string; request_type: string }>>(
    admin,
    "GET",
    `/api/privacy-requests?patient_id=${patient.id}`,
  );
  expect(register[0]).toMatchObject({ received_via: "portal", request_type: "correction" });
});
