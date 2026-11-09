import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { rxItemsToInput } from "./rxAdapter";
import type { RxItem } from "./rxModel";

/**
 * "Buy outside" is chosen on purpose (owner, 2026-11-09): from the drug
 * search, the prescriber, doctor or nurse, writes a medicine the hospital does
 * not stock as bought outside, with its name, strength and dose. The line is
 * sent with the marker and no catalogue item, so it is never dispensed or
 * billed; a nurse's line still waits for the doctor.
 */
vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { listPharmacyCatalog: vi.fn(async () => []) },
}));

// jsdom has no scrolling; the combobox scrolls its highlighted match.
Element.prototype.scrollIntoView = vi.fn();

const { RxDoctor } = await import("./RxDoctor");

const SAFETY = {
  interactions: [],
  allergy_conflicts: [],
  weight_alerts: [],
  renal_alerts: [],
  hepatic_alerts: [],
  ingredient_alerts: [],
  pregnancy_alerts: [],
  conclusion: { severity: "clear", summary: "", recommendation: "", issue_count: 0 },
} as const;

/** Renders the writer as `prescriber`; returns the save spy. */
function renderWriter(prescriber: "doctor" | "nurse") {
  const onSave = vi.fn<(items: RxItem[]) => void>();
  render(
    <RxDoctor
      formulary={[]}
      formularyLoading={false}
      formularyById={{}}
      nlemGenerics={new Set()}
      initialItems={[]}
      patientName="Desk Patient"
      patientAllergies={[]}
      prescriber={prescriber}
      canSave
      saving={false}
      editing={false}
      safety={{ ...SAFETY, conclusion: { ...SAFETY.conclusion } }}
      signer={{ name: "Dr Desk", reg: "doctor", nurseName: "Nurse Desk", nurseReg: "Nursing" }}
      templates={[]}
      templateToItems={() => []}
      onSaveTemplate={() => {}}
      onSave={onSave}
    />,
  );
  return onSave;
}

/** Writes "Zincovit 500 mg, 1 tab" as a buy-outside line from the search. */
async function addOutside() {
  await userEvent.type(screen.getByLabelText("Search formulary"), "Zincovit");
  await userEvent.click(await screen.findByText(/Buy outside: “Zincovit”/));
  expect(await screen.findByLabelText(/Medicine/)).toHaveValue("Zincovit");
  await userEvent.type(screen.getByLabelText(/Strength/), "500 mg");
  await userEvent.type(screen.getByLabelText(/Dose/), "1 tab");
  await userEvent.click(screen.getByText("Add as buy outside"));
  expect(await screen.findByText("Buy outside")).toBeInTheDocument();
}

describe("the prescription writer, buy outside", () => {
  it("lets a doctor add a medicine bought outside, sent with the marker", async () => {
    const onSave = renderWriter("doctor");
    await addOutside();
    await userEvent.click(screen.getByText("Sign & save"));
    const items = onSave.mock.calls[0]?.[0] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Zincovit 500 mg",
      strength: "1 tab",
      buyOutside: true,
    });
    const [input] = rxItemsToInput(items);
    expect(input?.buy_outside).toBe(true);
    expect(input?.catalog_item_id).toBeUndefined();
  });

  it("lets a nurse add one too, waiting for the doctor", async () => {
    const onSave = renderWriter("nurse");
    await addOutside();
    expect(screen.getByText("pending MD")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Send to doctor"));
    const items = onSave.mock.calls[0]?.[0] ?? [];
    expect(items[0]).toMatchObject({ buyOutside: true, pendingMD: true });
  });

  it("needs the dose before the line is added", async () => {
    renderWriter("doctor");
    await userEvent.type(screen.getByLabelText("Search formulary"), "Zincovit");
    await userEvent.click(await screen.findByText(/Buy outside: “Zincovit”/));
    await userEvent.click(await screen.findByText("Add as buy outside"));
    expect(await screen.findByText("Give the dose, for example 1 tab")).toBeInTheDocument();
  });
});
