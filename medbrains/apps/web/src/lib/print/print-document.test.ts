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
      key === "consent.general"
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
    // Culture sensitivity is the sentinel: it reads antibiotic_sensitivities
    // and culture_results, neither of which any migration creates, and it was
    // offered on the lab order print menu until the generator checked.
    const keys = ALL_PRINT_DOCUMENTS.map((d) => d.key);
    expect(keys).not.toContain("culture-sensitivity");
    expect(keys).not.toContain("rca-template");
  });
});
