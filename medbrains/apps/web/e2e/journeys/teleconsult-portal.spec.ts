/**
 * A video consultation from both ends (#229): the patient finds it on the
 * portal with a link to join; the doctor starts the call, which opens the
 * visit, and goes straight to that visit to write the notes and prescription.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { latestPortalCode } from "../helpers/patient-sms";
import { expect, test } from "./support/world";

test("the patient sees the call on the portal and the doctor opens its visit", async ({ hospital }) => {
  test.setTimeout(120_000);
  const admin = hospital.admin;
  const tenant = await api<{ code: string }>(admin, "GET", "/api/setup/tenant");
  const phone = `9${String(Date.now()).slice(-9)}`;
  const last = `Tele${Date.now().toString(36)}`;
  const patient = await createPatientApi(admin, { phone, lastName: last });
  const doctor = await hospital.doctor();
  await api(admin, "POST", "/api/telemedicine/consultations", {
    patient_id: patient.id,
    doctor_id: doctor.id,
    scheduled_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const portal = await hospital.asPublic();
  await portal.goto(`/portal/${tenant.code}`);
  await portal.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await portal.getByRole("button", { name: "Send code" }).click();
  await portal.getByRole("textbox", { name: "Code" }).fill(latestPortalCode(phone));
  await portal.getByRole("button", { name: "Sign in" }).click();
  await portal.getByRole("tab", { name: "Visits" }).click();
  const calls = portal.getByRole("region", { name: "Video consultations" });
  await expect(calls).toContainText(doctor.fullName);
  await expect(calls.getByRole("link", { name: "Join" })).toHaveAttribute("href", /^https?:\/\//);

  const desk = await hospital.as("doctor");
  await desk.goto("/telemedicine");
  const row = desk.getByRole("row").filter({ hasText: last });
  const [call] = await Promise.all([desk.waitForEvent("popup"), row.getByRole("button", { name: "Join" }).click()]);
  await call.close();
  await row.getByRole("button", { name: "Open the visit" }).click();
  await expect(desk).toHaveURL(/\/opd\/encounters\/[0-9a-f-]{36}/);
});
