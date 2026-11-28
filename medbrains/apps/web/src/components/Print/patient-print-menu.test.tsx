import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The patient's one Print menu, and the list row's ID card button: each print
 * offered only to who the server will serve, the ID card on the printer the
 * hospital chose, and a setting that could not be read never printed as a
 * guess.
 */
let granted = new Set(["patients.view"]);
const printDocument = vi.fn(async () => ({ ok: true }));
const getSearchSettings = vi.fn();
const toastError = vi.fn();

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((code) => granted.has(code)),
  useHasPermission: (code: string) => granted.has(code),
  useFieldAccess: () => "edit",
}));
vi.mock("@/lib/print/printDocument", () => ({ printDocument }));
vi.mock("@/services/patients.service", () => ({ patientsService: { getSearchSettings } }));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  toast: { error: toastError, success: vi.fn() },
}));

const { PatientPrintMenu } = await import("./PatientPrintMenu");
const { PrintIdCardButton } = await import("./PrintIdCardButton");

/** Answers the settings read with this card printer. */
function cardPrinter(printer: "thermal" | "cr80") {
  getSearchSettings.mockResolvedValue({
    default_by: "all",
    opd_number_enabled: false,
    patient_list_columns: "full",
    card_printer: printer,
  });
}

/** Opens the header menu once the settings read has settled. */
async function openMenu() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await userEvent.click(screen.getByRole("button", { name: "Print" }));
}

/**
 * The menu's items. Read with `hidden: true` because jsdom lays nothing out:
 * Mantine's popover sees a zero-size target as detached and hides the open
 * dropdown (`hideDetached`), which a browser never does here.
 */
function menuItem(name: string | RegExp) {
  return screen.findByRole("menuitem", { name, hidden: true });
}

/** Whether the open menu holds an item of this name. */
function hasMenuItem(name: string | RegExp) {
  return screen.queryByRole("menuitem", { name, hidden: true }) !== null;
}

describe("PatientPrintMenu", () => {
  beforeEach(() => {
    granted = new Set(["patients.view"]);
    printDocument.mockClear();
    toastError.mockClear();
    cardPrinter("thermal");
  });

  it.each([
    ["thermal", "patient-card"],
    ["cr80", "opd-card"],
  ] as const)("prints the %s card as %s", async (printer, key) => {
    cardPrinter(printer);
    render(<PatientPrintMenu patientId="pat-1" />);
    await openMenu();
    const item = await menuItem("ID card");
    expect(item).toBeEnabled();
    await userEvent.click(item);
    expect(printDocument).toHaveBeenCalledWith(key, "pat-1");
  });

  it("shows why the ID card cannot print when the setting could not be read", async () => {
    getSearchSettings.mockRejectedValue(new Error("down"));
    render(<PatientPrintMenu patientId="pat-1" />);
    await openMenu();
    const item = await menuItem(/ID card/);
    expect(item).toHaveTextContent("The card printer setting could not be loaded");
    expect(item).toBeDisabled();
    expect(printDocument).not.toHaveBeenCalled();
  });

  it("offers the card, the slip and, inside a visit, the token ticket", async () => {
    render(
      <PatientPrintMenu
        patientId="pat-1"
        encounterId="enc-1"
        token="OP-1"
        onRegistrationSlip={vi.fn()}
      />,
    );
    await openMenu();
    const items = await screen.findAllByRole("menuitem", { hidden: true });
    expect(items.map((item) => item.textContent)).toEqual([
      "ID card",
      "Registration slip (A4)",
      "Token ticket",
    ]);
    await userEvent.click(items[2] as HTMLElement);
    expect(printDocument).toHaveBeenCalledWith("opd-visit-card", "enc-1");
  });

  it("prints the registration slip through the screen's handler", async () => {
    const slip = vi.fn();
    render(<PatientPrintMenu patientId="pat-1" onRegistrationSlip={slip} />);
    await openMenu();
    await userEvent.click(await menuItem("Registration slip (A4)"));
    expect(slip).toHaveBeenCalled();
  });

  it("offers no token ticket outside a visit", async () => {
    render(<PatientPrintMenu patientId="pat-1" onRegistrationSlip={vi.fn()} />);
    await openMenu();
    await menuItem("ID card");
    expect(hasMenuItem(/token ticket/i)).toBe(false);
  });

  it("shows the ticket disabled, with the reason, when the visit has no token", async () => {
    render(<PatientPrintMenu patientId="pat-1" encounterId="enc-1" token={null} />);
    await openMenu();
    const ticket = await menuItem(/token ticket/i);
    expect(ticket).toBeDisabled();
    expect(ticket).toHaveTextContent("No token was issued for this visit");
  });

  it("gives the desk with only the reprint grant the cards, not the slip", async () => {
    granted = new Set(["patients.card.reprint"]);
    render(<PatientPrintMenu patientId="pat-1" onRegistrationSlip={vi.fn()} />);
    await openMenu();
    await menuItem("ID card");
    expect(hasMenuItem(/registration slip/i)).toBe(false);
  });

  it("is not shown, and reads no setting, without a print the server would serve", () => {
    granted = new Set();
    getSearchSettings.mockClear();
    render(<PatientPrintMenu patientId="pat-1" encounterId="enc-1" onRegistrationSlip={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /print/i })).not.toBeInTheDocument();
    expect(getSearchSettings).not.toHaveBeenCalled();
  });

  it("names itself for screen readers in a table row", () => {
    render(<PatientPrintMenu encounterId="enc-1" token="OP-014" patientId="pat-1" compact />);
    expect(screen.getByRole("button", { name: "Print token or ID card" })).toBeInTheDocument();
  });
});

describe("PrintIdCardButton", () => {
  beforeEach(() => {
    granted = new Set(["patients.view"]);
    printDocument.mockClear();
    toastError.mockClear();
  });

  it("prints the card the setting names", async () => {
    cardPrinter("cr80");
    render(<PrintIdCardButton patientId="pat-1" ariaLabel="Print ID card for U-1" />);
    const button = screen.getByRole("button", { name: "Print ID card for U-1" });
    await vi.waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(printDocument).toHaveBeenCalledWith("opd-card", "pat-1");
  });

  it("says the setting could not be read rather than printing thermal", async () => {
    getSearchSettings.mockRejectedValue(new Error("down"));
    render(<PrintIdCardButton patientId="pat-1" ariaLabel="Print ID card for U-1" />);
    const button = screen.getByRole("button", { name: "Print ID card for U-1" });
    await vi.waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(printDocument).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("could not be loaded"),
      expect.anything(),
    );
  });

  it("is not shown without the card permission", () => {
    granted = new Set();
    render(<PrintIdCardButton patientId="pat-1" ariaLabel="Print ID card for U-1" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
