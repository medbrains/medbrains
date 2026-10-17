/**
 * Imaging flows (#226): the radiology manager sets the PACS address; a new
 * order goes onto the modality worklist under its accession number; the
 * modality's study (here made in the PACS directly) comes back to the order,
 * which completes and opens its images in the embedded viewer.
 *
 * Needs the development Orthanc (`docker compose up -d orthanc`).
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

const ORTHANC = "http://127.0.0.1:8042";

test("an order reaches the PACS worklist and its images open on the order", async ({ hospital, request }) => {
  test.setTimeout(240_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const before = await api<Record<string, unknown>>(hospital.admin, "GET", "/api/radiology/pacs-config");

  const page = await hospital.asAdmin();
  await page.goto("/radiology?tab=modalities");
  const pacs = page.getByRole("form", { name: "PACS connection" });
  await pacs.getByRole("textbox", { name: "PACS address" }).fill(ORTHANC);
  await pacs.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("New orders go onto the worklist")).toBeVisible();

  try {
    const patient = await createPatientApi(hospital.admin, { firstName: "Imaging", lastName: `Pacs${t}` });
    const ct = await api<{ id: string }>(hospital.admin, "POST", "/api/radiology/modalities", {
      code: `CT${t}`,
      name: `CT ${t}`,
    });
    const order = await api<{ id: string; accession_number: string }>(hospital.admin, "POST", "/api/radiology/orders", {
      patient_id: patient.id,
      modality_id: ct.id,
      body_part: "Head",
    });

    // The outbox worker puts it on the modality worklist.
    await expect
      .poll(
        async () => {
          const items = (await (await request.get(`${ORTHANC}/worklists`)).json()) as Array<{ Tags: { AccessionNumber: string } }>;
          return items.some((w) => w.Tags.AccessionNumber === order.accession_number);
        },
        { timeout: 60_000 },
      )
      .toBe(true);

    // The modality sends the study under that accession.
    await request.post(`${ORTHANC}/tools/create-dicom`, {
      data: {
        Tags: {
          PatientID: patient.uhid, PatientName: `Pacs${t}^Imaging`, AccessionNumber: order.accession_number,
          Modality: "CT", StudyDescription: "CT head plain", SOPClassUID: "1.2.840.10008.5.1.4.1.1.2",
        },
      },
    });

    await page.goto("/radiology");
    const row = page.getByRole("row").filter({ hasText: `Pacs${t}` }).first();
    await row.getByRole("button", { name: "View details" }).click();
    const drawer = page.getByRole("dialog", { name: "Order Detail" });
    const images = drawer.getByRole("region", { name: "Images" });
    await expect(images).toContainText(order.accession_number);
    // The sync runs every minute; reopen until the study has come back.
    await expect
      .poll(
        async () => {
          await page.reload();
          await page.getByRole("row").filter({ hasText: `Pacs${t}` }).first().getByRole("button", { name: "View details" }).click();
          return page
            .getByRole("button", { name: "View images" })
            .waitFor({ state: "visible", timeout: 8_000 })
            .then(() => true)
            .catch(() => false);
        },
        { timeout: 150_000, intervals: [10_000] },
      )
      .toBe(true);
    await page.getByRole("button", { name: "View images" }).click();
    const viewer = page.getByTitle(`Images for ${order.accession_number}`);
    await expect(viewer).toHaveAttribute("src", /\/ohif\/viewer\?StudyInstanceUIDs=/);
  } finally {
    await api(hospital.admin, "PUT", "/api/radiology/pacs-config", { ...before, orthanc_url: before.orthanc_url ?? "" });
  }
});
