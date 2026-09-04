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
