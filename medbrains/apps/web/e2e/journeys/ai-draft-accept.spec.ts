/**
 * AI proposes, a clinician accepts (#4895). An assistant answer is labelled
 * as AI, reaches a note only through an explicit Accept on the case sheet,
 * and the accepted section stays marked AI-assisted after a reload.
 *
 * The language model is the one external system mocked here: `/api/ai/chat`
 * answers a canned stream, because no model runs in the test environment.
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

const AI_PLAN = "Paracetamol 500 mg if fever above 38.5 C";

test("an AI draft reaches the note only when the doctor accepts it", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });

  const page = await hospital.as("doctor");
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: `data: ${JSON.stringify({ type: "text", text: AI_PLAN })}\n\ndata: {"type":"done"}\n\n`,
    }),
  );

  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  const plan = page.getByRole("textbox", { name: "Plan", exact: true });
  await expect(plan).toBeVisible();
  // Nothing is offered before the assistant has said anything.
  await expect(page.getByRole("button", { name: "Insert AI draft into Plan" })).toHaveCount(0);

  await page.getByRole("button", { name: /Open MedBrains assistant/ }).click();
  const assistant = page.getByRole("dialog");
  await assistant.getByRole("textbox", { name: "Message the assistant" }).fill("Draft a plan");
  await assistant.getByRole("button", { name: "Send message" }).click();
  await expect(assistant.getByText(AI_PLAN)).toBeVisible();
  await expect(assistant.getByLabel("AI-generated answer")).toBeVisible();
  await assistant.getByRole("button", { name: "Use in note" }).click();
  await page.keyboard.press("Escape");

  // Offered, not applied: the plan is still empty until the doctor accepts.
  await expect(plan).not.toContainText(AI_PLAN);
  await page.getByRole("button", { name: "Insert AI draft into Plan" }).click();
  const review = page.getByRole("dialog", { name: "AI draft for Plan" });
  await expect(review.getByLabel("AI-generated draft")).toBeVisible();
  await expect(plan).not.toContainText(AI_PLAN);
  await review.getByRole("button", { name: "Accept and insert" }).click();

  await expect(plan).toContainText(AI_PLAN);
  await expect(page.getByLabel("Plan includes accepted AI text")).toBeVisible();
  await expect(page.getByText(/^Draft saved/)).toBeVisible({ timeout: 10_000 });

  // The mark is the server's record, not the screen's memory.
  await page.reload();
  await page.getByRole("tab", { name: "Consultation" }).click();
  await expect(page.getByRole("textbox", { name: "Plan", exact: true })).toContainText(AI_PLAN, {
    timeout: 15_000,
  });
  await expect(page.getByLabel("Plan includes accepted AI text")).toBeVisible();
});
