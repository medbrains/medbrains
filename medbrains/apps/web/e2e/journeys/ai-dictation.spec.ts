/**
 * AI notes from dictation, slice 1 (RFCs/modules/RFC-MODULE-ai-dictation.md).
 * A doctor uploads a recording on the consultation, reviews the draft beside
 * the transcript section by section, and only what they accept reaches their
 * note, marked AI-assisted; an accepted medicine waits on the prescription
 * pad and is prescribed there.
 *
 * The hospital's two machines are the only things faked: a whisper.cpp
 * server and a local model (Ollama's OpenAI-compatible chat), both small
 * HTTP servers started here and named in the hospital's dictation setting.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expectScreenAccessible } from "./support/a11y";
import { expect, test } from "./support/world";

const TRANSCRIPT = "Cough for a week. Chest clear. Viral bronchitis. Steam inhalation, review in a week.";
const DRAFT = {
  complaint: "Cough for a week",
  history: "",
  examination: "Chest clear",
  diagnoses: [{ description: "Acute bronchitis", icd10_code: "J20.9" }],
  plan: "Steam inhalation, review in a week",
  medicines: [{ name: "Cetirizine", dose: "10 mg", frequency: "at night", duration: "5 days", route: "oral" }],
};

/** Answer every POST with `body`; the server's address. */
async function fake(body: (path: string) => unknown): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body(req.url ?? "")));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, server };
}

const whisperReply = () => ({ text: TRANSCRIPT });
const modelReply = () => ({
  id: "chatcmpl-1",
  object: "chat.completion",
  created: 0,
  model: "llama3.2",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "call_1", index: 0, type: "function",
            function: { name: "submit", arguments: JSON.stringify(DRAFT) } },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

test("a doctor dictates by upload and only the accepted sections reach the note", async ({
  hospital,
  request,
}) => {
  test.setTimeout(120_000);
  const whisper = await fake(whisperReply);
  const model = await fake(modelReply);
  let restoreSettings: (() => Promise<unknown>) | null = null;
  try {
    // Dictation settings have their own endpoint (validated and audited); the
    // generic settings route refuses them. Put the hospital's back after.
    const before = await api<Record<string, unknown>>(hospital.admin, "GET", "/api/admin/dictation/settings");
    await api(hospital.admin, "PUT", "/api/admin/dictation/settings", {
      ...before,
      stt_url: whisper.url,
      llm_url: model.url,
    });
    restoreSettings = () => api(hospital.admin, "PUT", "/api/admin/dictation/settings", before);
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(hospital.admin);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: (await getOpdDept(doctorCtx)).id,
    });

    const page = await hospital.as("doctor");
    await page.goto(`/opd/encounters/${encounterId}`);
    await page.getByRole("tab", { name: "Consultation" }).click();
    const panel = page.getByLabel("Dictation");
    await expect(panel.getByRole("button", { name: "Dictate" })).toBeVisible();

    await panel.locator('input[type="file"]').setInputFiles({
      name: "consultation.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]),
    });

    // The draft sits beside what was said, labelled, and nothing is saved yet.
    await expect(panel.getByTestId("dictation-transcript")).toHaveText(TRANSCRIPT, {
      timeout: 20_000,
    });
    await expect(panel.getByLabel("AI-drafted from your dictation")).toBeVisible();
    await expect(panel.getByLabel("Assessment as drafted")).toHaveValue(
      "Acute bronchitis (suggested ICD-10 J20.9, verify)",
    );
    await expect(panel.getByRole("button", { name: "Save to note" })).toBeDisabled();
    // The review screen meets WCAG 2.2 AA (labelled controls, contrast, names).
    await expectScreenAccessible(page, "opd-dictation-review");

    // The doctor corrects the assessment, keeps the plan, drops the rest.
    const assessment = panel.getByLabel("Assessment as drafted");
    await assessment.fill("Acute viral bronchitis");
    await panel.getByRole("button", { name: "Accept: Assessment" }).click();
    await panel.getByRole("button", { name: "Accept: Plan" }).click();
    await panel.getByRole("button", { name: "Reject: Subjective" }).click();
    await panel.getByRole("button", { name: "Reject: Objective" }).click();
    await panel.getByRole("button", { name: "Add to prescription pad: Cetirizine" }).click();
    await panel.getByRole("button", { name: "Save to note" }).click();
    await expect(page.getByText("Saved to your note")).toBeVisible({ timeout: 15_000 });

    // The note holds exactly what was accepted, marked AI-assisted.
    await expect(page.getByRole("textbox", { name: "Assessment", exact: true })).toContainText(
      "Acute viral bronchitis",
      { timeout: 15_000 },
    );
    await expect(page.getByRole("textbox", { name: "Plan", exact: true })).toContainText(
      "Steam inhalation, review in a week",
    );
    await expect(page.getByRole("textbox", { name: "Subjective", exact: true })).not.toContainText(
      "Cough for a week",
    );
    await expect(page.getByLabel("Plan includes accepted AI text")).toBeVisible();

    // The medicine is a suggestion, not a prescription. This hospital's
    // formulary has no drug by the spoken name, so the doctor is asked to pick
    // one, with what they said read back; nothing is guessed for them.
    await page.getByRole("tab", { name: "Prescriptions" }).click();
    await expect(page.getByText("Pick the drug for these dictated medicines")).toBeVisible();
    await expect(page.getByText("Cetirizine 10 mg at night 5 days oral")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Drug for Cetirizine" })).toBeVisible();
  } finally {
    await restoreSettings?.();
    whisper.server.close();
    model.server.close();
  }
});
