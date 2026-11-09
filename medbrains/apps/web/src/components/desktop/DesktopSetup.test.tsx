import { afterEach, describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { DesktopSetup } from "./DesktopSetup";

/**
 * The hospital QR is unsigned: anyone can print one naming any hospital. So
 * the screen must ask the person to confirm the address the desktop will open,
 * never the name, which is shown only as an unverified hint.
 */
type Global = { __TAURI_INTERNALS__?: { invoke: (cmd: string) => Promise<unknown> } };

afterEach(() => {
  delete (globalThis as Global).__TAURI_INTERNALS__;
});

describe("desktop setup", () => {
  it("confirms the address from a QR and labels its name as not verified", async () => {
    (globalThis as Global).__TAURI_INTERNALS__ = {
      invoke: async () => ({ hospital: "City Hospital", address: "https://evil.example" }),
    };
    render(<DesktopSetup />);
    await userEvent.type(screen.getByLabelText("Or scan the hospital QR"), "medbrains://bind?t=x");
    await userEvent.click(screen.getByRole("button", { name: "Read the code" }));

    expect(
      await screen.findByRole("button", { name: "Connect to https://evil.example" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Connect to https://evil.example")).toHaveLength(2);
    expect(screen.getByText("Name from the QR code (not verified): City Hospital")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /City Hospital/ })).toBeNull();
  });
});
