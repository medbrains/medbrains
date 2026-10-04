/**
 * Dr A asks a named cardiologist for an opinion. The cardiologist accepts it
 * from "Referrals for me", finds the patient in their own queue, gives the
 * opinion, and the patient is back in Dr A's queue with the answer on the
 * visit (RFC-MODULE-opd-referral-journey, slice 1).
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

const REASON = "Exertional chest pain, ST depression on ECG";
const OPINION = "Stable angina: aspirin and statin, treadmill test next week";

test("a referral is accepted, answered, and the patient comes back", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const drA = await hospital.doctor();
  const cardiology = await hospital.department("Cardiology");
  const drB = await hospital.colleague(cardiology);

  // Dr A refers from the visit.
  const a = await hospital.as("doctor");
  await a.goto(`/opd/encounters/${encounterId}`);
  await a.getByRole("tab", { name: "Referrals", exact: true }).click();
  await a.getByRole("button", { name: "New Referral" }).click();
  const form = a.getByRole("dialog", { name: "New Referral" });
  await form.getByRole("combobox", { name: "Refer to Department" }).click();
  await a.getByRole("option", { name: cardiology.name, exact: true }).click();
  await form.getByRole("textbox", { name: "Refer to doctor" }).click();
  await a.getByRole("option", { name: new RegExp(drB.fullName) }).click();
  await form.getByLabel("Reason for Referral").fill(REASON);
  await form.getByRole("button", { name: "Create Referral" }).click();
  await expect(form).toBeHidden();

  // Dr B accepts it from what is waiting for them.
  const b = drB.page;
  await b.goto("/opd#referrals");
  await b.getByRole("tab", { name: "Referral Tracking" }).click();
  const incoming = b.getByRole("row", { name: new RegExp(REASON) });
  await expect(incoming).toBeVisible({ timeout: 10_000 });
  await incoming.getByRole("button", { name: "Accept" }).click();
  await expect(incoming.getByRole("button", { name: "Give opinion" })).toBeVisible();

  // The patient is in Dr B's own queue, saying who asked and why.
  await b.getByRole("tab", { name: "Queue", exact: true }).click();
  await b.getByRole("switch", { name: "My Patients" }).check();
  const consult = b.getByRole("row", { name: new RegExp(patient.uhid) });
  await expect(consult).toContainText("Opinion requested", { timeout: 10_000 });
  await expect(consult).toContainText(`Dr. ${drA.fullName}`);

  // Dr B answers and sends the patient back.
  await b.getByRole("tab", { name: "Referral Tracking" }).click();
  await incoming.getByRole("button", { name: "Give opinion" }).click();
  const answer = b.getByRole("dialog", { name: "Give opinion" });
  await answer.getByLabel("Your opinion").fill(OPINION);
  await expect(answer.getByRole("checkbox", { name: /Send the patient back/ })).toBeChecked();
  await answer.getByRole("button", { name: "Send opinion" }).click();
  await expect(answer).toBeHidden();

  // Back with Dr A: in the queue, and the answer is on the visit.
  await a.goto("/opd");
  await a.getByRole("switch", { name: "My Patients" }).check();
  await expect(a.getByRole("row", { name: new RegExp(patient.uhid) }).filter({
    hasText: "Back with opinion",
  })).toBeVisible({ timeout: 10_000 });
  await a.goto(`/opd/encounters/${encounterId}`);
  await a.getByRole("tab", { name: "Referrals", exact: true }).click();
  await expect(a.getByText(OPINION)).toBeVisible();
});

test("a referral can be declined with a reason, and withdrawn only by its sender", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const ortho = await hospital.department("Orthopaedics");
  const drB = await hospital.colleague(ortho);

  const a = await hospital.as("doctor");
  await a.goto(`/opd/encounters/${encounterId}`);
  await a.getByRole("tab", { name: "Referrals", exact: true }).click();
  await a.getByRole("button", { name: "New Referral" }).click();
  const form = a.getByRole("dialog", { name: "New Referral" });
  await form.getByRole("combobox", { name: "Refer to Department" }).click();
  await a.getByRole("option", { name: ortho.name, exact: true }).click();
  await form.getByLabel("Reason for Referral").fill("Knee pain on stairs");
  await form.getByRole("button", { name: "Create Referral" }).click();
  await expect(form).toBeHidden();
  // The sender sees Withdraw, not Accept.
  await expect(a.getByRole("button", { name: "Withdraw" })).toBeVisible();
  await expect(a.getByRole("button", { name: "Accept" })).toHaveCount(0);

  // Any orthopaedic doctor may answer a referral to the department.
  const b = drB.page;
  await b.goto("/opd");
  await b.getByRole("tab", { name: "Referral Tracking" }).click();
  const incoming = b.getByRole("row", { name: /Knee pain on stairs/ });
  await incoming.getByRole("button", { name: "Decline" }).click();
  const decline = b.getByRole("dialog", { name: "Decline referral" });
  await expect(decline.getByRole("button", { name: "Decline" })).toBeDisabled();
  await decline.getByLabel("Why you are declining").fill("Mechanical pain; physiotherapy first");
  await decline.getByRole("button", { name: "Decline" }).click();
  await expect(decline).toBeHidden();

  await a.reload();
  await a.getByRole("tab", { name: "Referrals", exact: true }).click();
  await expect(a.getByText("Mechanical pain; physiotherapy first")).toBeVisible();
  await expect(a.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
});
