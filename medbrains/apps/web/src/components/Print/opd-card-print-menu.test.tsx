import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * "Print OPD card" is offered only to who the server will serve, prints the
 * visit's card when there is a visit, and prints on the paper chosen.
 */
let permitted = true;
const printDocument = vi.fn(async () => ({ ok: true }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => permitted,
  useFieldAccess: () => "edit",
}));
vi.mock("@/lib/print/printDocument", () => ({ printDocument }));

const { OpdCardPrintMenu } = await import("./OpdCardPrintMenu");

describe("OpdCardPrintMenu", () => {
  beforeEach(() => {
    permitted = true;
    printDocument.mockClear();
  });

  it("prints the visit's card on the half-A4 slip", async () => {
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" />);
    await userEvent.click(screen.getByRole("button", { name: /print opd card/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /opd slip/i }));
    expect(printDocument).toHaveBeenCalledWith("opd-visit-card", "enc-1", { format: "slip" });
  });

  it("prints the patient's card on CR80 when there is no visit", async () => {
    render(<OpdCardPrintMenu patientId="pat-1" />);
    await userEvent.click(screen.getByRole("button", { name: /print opd card/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /id card/i }));
    expect(printDocument).toHaveBeenCalledWith("opd-card", "pat-1", { format: "id-card" });
  });

  it("is not offered without the permission the card's endpoint checks", () => {
    permitted = false;
    render(<OpdCardPrintMenu patientId="pat-1" encounterId="enc-1" />);
    expect(screen.queryByRole("button", { name: /print opd card/i })).not.toBeInTheDocument();
  });

  it("names itself for screen readers in a table row", () => {
    render(<OpdCardPrintMenu encounterId="enc-1" compact />);
    expect(screen.getByRole("button", { name: "Print OPD card" })).toBeInTheDocument();
  });
});
