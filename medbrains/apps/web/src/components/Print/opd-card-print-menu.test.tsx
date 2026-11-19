import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The OPD print control offers the token ticket for a visit and the ID card for
 * a patient, each printing its own document, only to who the server will serve.
 */
let granted = new Set(["patients.view"]);
const printDocument = vi.fn(async () => ({ ok: true }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((code) => granted.has(code)),
  useFieldAccess: () => "edit",
}));
vi.mock("@/lib/print/printDocument", () => ({ printDocument }));

const { OpdCardPrintMenu } = await import("./OpdCardPrintMenu");

describe("OpdCardPrintMenu", () => {
  beforeEach(() => {
    granted = new Set(["patients.view"]);
    printDocument.mockClear();
  });

  it.each([
    [/token ticket/i, "opd-visit-card", "enc-1"],
    [/patient id card/i, "opd-card", "pat-1"],
  ])("offers both prints for a visit; %s prints its own document", async (item, key, id) => {
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" token="OP-014" />);
    await userEvent.click(screen.getByRole("button", { name: /print token or id card/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
    expect(printDocument).toHaveBeenCalledWith(key, id);
  });

  it("shows the ticket disabled, with the reason, when the visit has no token", async () => {
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" token={null} />);
    await userEvent.click(screen.getByRole("button", { name: /print token or id card/i }));
    const ticket = await screen.findByRole("menuitem", { name: /token ticket/i });
    expect(ticket).toBeDisabled();
    expect(ticket).toHaveTextContent("No token was issued for this visit");
  });

  it("offers only the ID card where there is no visit", async () => {
    render(<OpdCardPrintMenu patientId="pat-1" />);
    await userEvent.click(screen.getByRole("button", { name: /print id card/i }));
    await screen.findByRole("menuitem", { name: /patient id card/i });
    expect(screen.queryByRole("menuitem", { name: /token ticket/i })).not.toBeInTheDocument();
  });

  it("is not offered without the permission the endpoints check", () => {
    granted = new Set();
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" token="OP-014" />);
    expect(screen.queryByRole("button", { name: /print/i })).not.toBeInTheDocument();
  });

  it("is offered to the desk with only the card reprint grant", () => {
    granted = new Set(["patients.card.reprint"]);
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" token="OP-014" />);
    expect(screen.getByRole("button", { name: /print token or id card/i })).toBeInTheDocument();
  });

  it("names itself for screen readers in a table row", () => {
    render(<OpdCardPrintMenu encounterId="enc-1" token="OP-014" patientId="pat-1" compact />);
    expect(screen.getByRole("button", { name: "Print token or ID card" })).toBeInTheDocument();
  });
});
