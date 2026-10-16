/**
 * A hospital adds a question to its procedure consent (#220): the
 * administrator customises the built-in consent form and publishes it; the
 * doctor's next consent asks that question, refuses to save without an
 * answer, and the saved consent shows the answer against the version it was
 * taken on. The form is put back afterwards.
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

interface Item {
  id: string | null;
  code: string;
  status: string;
}
interface Detail {
  template: { draft: unknown; name: string };
}

test("the hospital adds a question to its consent and the doctor must answer it", async ({
  hospital,
  request,
}) => {
  test.setTimeout(180_000);
  const t = Date.now().toString(36).slice(-5);
  const question = `Interpreter used ${t}`;

  const consentForm = async () =>
    (await api<Item[]>(hospital.admin, "GET", "/api/forms/templates")).find(
      (i) => i.code === "procedure_consent",
    );

  const admin = await hospital.asAdmin();
  await admin.goto("/admin/forms");
  const row = admin.getByRole("row").filter({ hasText: "Procedure consent" });
  await row.getByRole("button", { name: /Customise|Edit/ }).click();
  const editor = admin.getByRole("form", { name: "Form editor" });
  await expect(editor).toBeVisible();
  // Remember the draft as it was (a fresh customisation is the built-in form), to put it back.
  const templateId = (await consentForm())?.id;
  const original = templateId
    ? await api<Detail>(hospital.admin, "GET", `/api/forms/templates/${templateId}`)
    : null;
  try {
    await editor.getByRole("button", { name: "Add question" }).last().click();
    const label = editor.getByRole("textbox", { name: "Question", exact: true }).last();
    await label.fill(question);
    await label.blur();
    await editor.getByRole("combobox", { name: "Answer type" }).last().click();
    await admin.getByRole("option", { name: "Yes / No" }).click();
    await editor.getByRole("switch", { name: "Required" }).last().check({ force: true });
    await expect(admin.getByRole("radiogroup", { name: question })).toBeVisible();
    await editor.getByRole("button", { name: "Publish" }).click();
    await expect(admin.getByText(/Staff now fill in version \d+/)).toBeVisible();

    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(hospital.admin);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: (await getOpdDept(doctorCtx)).id,
    });
    const doctor = await hospital.as("doctor");
    await doctor.goto(`/opd/encounters/${encounterId}`);
    await doctor.getByRole("button", { name: /^More \(\d+\)$/ }).click();
    await doctor.getByRole("tab", { name: "Consents", exact: true }).click();
    await doctor.getByRole("button", { name: "New Consent" }).click();
    const modal = doctor.getByRole("dialog", { name: "New procedure consent" });
    await modal.getByRole("textbox", { name: "Procedure name" }).fill(`Excision ${t}`);
    await modal.getByRole("textbox", { name: "Witness name" }).fill("Staff Nurse Meena");
    await modal.getByRole("button", { name: "Create consent" }).click();
    await expect(modal.getByText(`${question} is required`)).toBeVisible();

    await modal.getByRole("radiogroup", { name: question }).getByRole("radio", { name: "Yes" }).check();
    await modal.getByRole("button", { name: "Create consent" }).click();
    await expect(modal).toBeHidden();

    await doctor.getByRole("button", { name: `View consent for Excision ${t}` }).click();
    const view = doctor.getByRole("dialog", { name: `Excision ${t}` });
    await expect(view.getByText(/Hospital consent form, version \d+/)).toBeVisible();
    await expect(
      view.getByRole("radiogroup", { name: question }).getByRole("radio", { name: "Yes" }),
    ).toBeChecked();
    await expect(view.getByRole("textbox", { name: "Witness name" })).toHaveValue("Staff Nurse Meena");
  } finally {
    if (templateId && original) {
      await api(hospital.admin, "PUT", `/api/forms/templates/${templateId}`, {
        name: original.template.name,
        draft: original.template.draft,
      });
      await api(hospital.admin, "POST", `/api/forms/templates/${templateId}/retire`);
    }
  }
});
