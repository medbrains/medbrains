import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/** The patient list row offers "Print ID card" only to who may print a card (tests see i18n keys). */
let granted = new Set(["patients.view"]);

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((code) => granted.has(code)),
}));
vi.mock("@/services/patients.service", () => ({
  patientsService: { getSearchSettings: async () => ({ card_printer: "thermal" }) },
}));

const { PatientRowActions } = await import("./row-actions");
const row = { id: "pat-1", uhid: "U-1" } as Parameters<typeof PatientRowActions>[0]["row"];

describe("PatientRowActions", () => {
  it("offers the ID card print beside the profile", () => {
    granted = new Set(["patients.view"]);
    render(<PatientRowActions row={row} />);
    expect(screen.getByRole("button", { name: /printIdCardFor/ })).toBeInTheDocument();
  });

  it("hides the ID card print without the card permission", () => {
    granted = new Set();
    render(<PatientRowActions row={row} />);
    expect(screen.queryByRole("button", { name: /printIdCardFor/ })).not.toBeInTheDocument();
  });
});
