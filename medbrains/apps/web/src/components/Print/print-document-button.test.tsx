import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The button must not offer what the server will refuse.
 *
 * The audit found tabs gated on `.list` holding buttons that needed
 * `.create` — a control that promises what the server denies. Each print
 * button mirrors the permission its own endpoint enforces.
 */
let permitted = true;

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => permitted,
  useFieldAccess: () => "edit",
}));

const { PrintDocumentButton } = await import("./PrintDocumentButton");

describe("PrintDocumentButton", () => {
  it("offers a registered document when the permission is held", () => {
    permitted = true;
    render(<PrintDocumentButton documentKey="consent.general" recordId="adm-1" />);
    expect(screen.getByRole("button", { name: /general consent/i })).toBeInTheDocument();
  });

  it("renders nothing when the permission is not held", () => {
    permitted = false;
    render(<PrintDocumentButton documentKey="consent.general" recordId="adm-1" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for an unregistered key rather than a dead button", () => {
    permitted = true;
    render(<PrintDocumentButton documentKey="consent.invented" recordId="adm-1" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is disabled without a record, rather than printing someone else's", () => {
    permitted = true;
    render(<PrintDocumentButton documentKey="consent.general" recordId={null} />);
    expect(screen.getByRole("button", { name: /general consent/i })).toBeDisabled();
  });
});
