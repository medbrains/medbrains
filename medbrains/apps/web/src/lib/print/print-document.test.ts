import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One command, callable from any page: `printDocument(key, id)`.
 *
 * The failures worth pinning are the quiet ones. A consent form that prints
 * blank because the fetch failed is worse than one that does not print — a
 * blank statutory form still looks like a form, and gets signed.
 */
let fetchImpl: (id: string) => Promise<unknown> = async () => ({ patient_name: "Asha R" });

vi.mock("./print-registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./print-registry")>();
  return {
    ...actual,
    printDocumentDef: (key: string) =>
      ["consent.general", "opd-card", "opd-visit-card"].includes(key)
        ? {
            key,
            label: "General consent",
            idKind: "admission" as const,
            permission: "ipd.admissions.view",
            fetch: (id: string) => fetchImpl(id),
          }
        : undefined,
  };
});

const { printDocument } = await import("./printDocument");

/** What the print window was handed, joined into one string. */
function captureWrite(): () => string {
  const chunks: string[] = [];
  vi.stubGlobal(
    "open",
    vi.fn(() => ({
      document: { write: (html: string) => chunks.push(html), close: vi.fn() },
    })),
  );
  return () => chunks.join("");
}

describe("printDocument", () => {
  beforeEach(() => {
    fetchImpl = async () => ({ patient_name: "Asha R", uhid: "UH-1" });
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ document: { write: vi.fn(), close: vi.fn() } })),
    );
  });

  it("prints a registered document for a record", async () => {
    const result = await printDocument("consent.general", "adm-1");
    expect(result.ok).toBe(true);
  });

  it("refuses an unregistered key rather than printing something empty", async () => {
    const result = await printDocument("consent.nonexistent", "adm-1");
    expect(result.ok).toBe(false);
    expect(result.problem).toMatch(/registered/i);
  });

  it("refuses without a record id, naming what it needs", async () => {
    const result = await printDocument("consent.general", "");
    expect(result.ok).toBe(false);
    expect(result.problem).toMatch(/admission/i);
  });

  it("does NOT print a blank form when the fetch fails", async () => {
    // The one that matters. A blank statutory consent form still looks like a
    // form, and a blank one gets signed.
    fetchImpl = async () => {
      throw new Error("503 upstream");
    };
    const result = await printDocument("consent.general", "adm-1");
    expect(result.ok).toBe(false);
    expect(result.problem).toMatch(/could not be loaded/i);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("says so when the pop-up is blocked, instead of failing silently", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    const result = await printDocument("consent.general", "adm-1");
    expect(result.ok).toBe(false);
    expect(result.problem).toMatch(/pop-?ups/i);
  });
});

describe("the generated registry", () => {
  it("registers every document under a unique key", async () => {
    const { ALL_PRINT_DOCUMENTS } =
      await vi.importActual<typeof import("./print-registry")>("./print-registry");
    const keys = ALL_PRINT_DOCUMENTS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every document a permission, so none is offered ungated", async () => {
    // A print button with no permission is a PHI document offered to anyone
    // who can reach the screen it sits on.
    const { ALL_PRINT_DOCUMENTS } =
      await vi.importActual<typeof import("./print-registry")>("./print-registry");
    const ungated = ALL_PRINT_DOCUMENTS.filter((d) => !d.permission);
    expect(ungated.map((d) => d.key)).toEqual([]);
  });

  it("covers the wider document set, not just the consents", async () => {
    const { ALL_PRINT_DOCUMENTS } =
      await vi.importActual<typeof import("./print-registry")>("./print-registry");
    // The point of this assertion is that the registry reaches past the eleven
    // hand-written consent forms into the generated set.
    //
    // It used to demand more than a hundred, which stopped being a quality
    // signal the moment the generator started excluding handlers that query
    // tables no migration creates: 56 of the 106 did, and each was a button
    // that 500s rather than a document. Counting those made the number go up
    // and the registry go down. Guard the floor, not the headline.
    expect(ALL_PRINT_DOCUMENTS.length).toBeGreaterThan(40);
  });

  it("offers no document whose handler queries a table that does not exist", async () => {
    const { ALL_PRINT_DOCUMENTS } =
      await vi.importActual<typeof import("./print-registry")>("./print-registry");
    // Culture sensitivity is the sentinel: it read antibiotic_sensitivities
    // and culture_results, neither of which any migration creates, and it was
    // offered on the lab order print menu until the generator checked. (The
    // RCA template was the other; it now reads quality_incidents and prints.)
    const keys = ALL_PRINT_DOCUMENTS.map((d) => d.key);
    expect(keys).not.toContain("culture-sensitivity");
  });

  /**
   * A checklist lives under `phases`, and nested values used to be dropped, so
   * the sheet printed the letterhead and none of the safety record. The ticks
   * and the unticked boxes both have to survive: an unticked box is the
   * document saying the step was not recorded, which is the whole point of
   * printing it.
   */
  it("prints nested sections, and an unticked box as unticked", async () => {
    fetchImpl = async () => ({
      patient_name: "Asha R",
      phases: [
        {
          label: "Sign in — before induction of anaesthesia",
          recorded: true,
          items: [
            { key: "site_marked", label: "Surgical site marked", checked: true },
            { key: "allergy", label: "Known allergy reviewed", checked: false },
          ],
        },
      ],
    });
    const written = captureWrite();
    await printDocument("consent.general", "adm-1");
    const html = written();
    expect(html).toContain("Sign in — before induction of anaesthesia");
    expect(html).toContain("[x] Surgical site marked");
    expect(html).toContain("[ ] Known allergy reviewed");
  });

  it("draws a signature's check link as a QR, not as text", async () => {
    const url = "https://hospital.example/verify/signature/abc123";
    fetchImpl = async () => ({
      patient_name: "Asha R",
      signatures: [{ signer_name: "Dr Iyer", verify_url: url }],
    });
    const written = captureWrite();
    await printDocument("consent.general", "adm-1");
    const html = written();
    expect(html).toContain("<svg");
    expect(html).toContain("Scan to check this document is unchanged");
    expect(html).not.toContain(url);
  });

  it("still prints the scalar fields beside the sections", async () => {
    fetchImpl = async () => ({ uhid: "UH-1", phases: [{ label: "Sign out", items: [] }] });
    const written = captureWrite();
    await printDocument("consent.general", "adm-1");
    expect(written()).toContain("UH-1");
  });

  it("prints a crossmatch's outcome and says when no unit is tied", async () => {
    // The shape the crossmatch report endpoint sends for a web-made
    // crossmatch: compatible, but the bank tied no bag to it.
    fetchImpl = async () => ({
      status: "compatible",
      result: "compatible",
      tested_at: "16-Nov-2026 09:30",
      unit_allocation: "No unit allocated yet",
      crossmatch_results: [],
    });
    const written = captureWrite();
    await printDocument("consent.general", "xm-1");
    const html = written();
    expect(html).toContain("<th>Status</th><td>compatible</td>");
    expect(html).toContain("<th>Tested at</th><td>16-Nov-2026 09:30</td>");
    expect(html).toContain("No unit allocated yet");
    expect(html).toContain("<h2>Crossmatch results</h2><p>None recorded</p>");
  });

  it("prints the token ticket and the ID card as two documents, each with its own page", async () => {
    const card = {
      hospital_name: "Rishi Hospital",
      hospital_logo_url: null,
      patient_name: "Asha Sample",
      uhid: "RH-000123",
      age: "34 Y",
      gender: "female",
      phone: "9000012345",
      visit: { visit_date: "17-Nov-2026", visit_time: "10:42", token_number: "OP-014" },
    };
    fetchImpl = async () => card;
    let written = captureWrite();
    await printDocument("opd-visit-card", "enc-1");
    expect(written()).toContain("size: 80mm 70mm");
    expect(written()).not.toContain("85.6mm");
    expect(written()).not.toContain("Asha Sample");

    written = captureWrite();
    await printDocument("opd-card", "pat-1");
    expect(written()).toContain("size: 85.6mm 54mm");
    expect(written()).not.toContain("OP-014");
    expect(written()).toContain("document.fonts.ready");
  });

  it("opens no window for a visit with no token, and says why", async () => {
    fetchImpl = async () => ({
      hospital_name: "Rishi Hospital",
      visit: { visit_date: "17-Nov-2026", visit_time: "10:42", token_number: null },
    });
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const result = await printDocument("opd-visit-card", "enc-1");
    expect(result).toEqual({
      ok: false,
      problem: "This visit has no token, so there is no ticket to print.",
    });
    expect(open).not.toHaveBeenCalled();
  });
});
