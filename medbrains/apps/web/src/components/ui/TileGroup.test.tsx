import { TextInput } from "@mantine/core";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { TileGroup, type TileOption, tileHotkeys } from "./TileGroup";

const TILES: TileOption[] = [
  { value: "cash", label: "Cash", hint: "Tendered and change" },
  { value: "card", label: "Card", hotkey: 2 },
  { value: "link", label: "Payment link", disabled: true, hint: "Coming soon", hotkey: 4 },
  { value: "upi", label: "UPI QR", hotkey: 3 },
];

function Picker({ start = null }: { start?: string | null }) {
  const [value, setValue] = useState<string | null>(start);
  return (
    <>
      <TextInput label="Amount" />
      <TileGroup label="Way of paying" data={TILES} value={value} onChange={setValue} />
    </>
  );
}

describe("TileGroup", () => {
  it("keeps each tile on its own key, and never a disabled tile's", () => {
    expect(tileHotkeys(TILES)).toEqual([
      { key: 1, value: "cash" },
      { key: 2, value: "card" },
      { key: 3, value: "upi" },
    ]);
  });

  it("picks a tile with its number key, and is a labelled radio group", async () => {
    render(<Picker />);
    expect(screen.getByRole("radiogroup", { name: "Way of paying" })).toBeInTheDocument();
    await userEvent.keyboard("3");
    expect(screen.getByRole("radio", { name: /UPI QR/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("1");
    expect(screen.getByRole("radio", { name: /Cash/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /UPI QR/ })).toHaveAttribute("aria-checked", "false");
  });

  it("leaves digits typed into a field alone", async () => {
    render(<Picker start="cash" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "3");
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("3");
    expect(screen.getByRole("radio", { name: /Cash/ })).toHaveAttribute("aria-checked", "true");
  });

  it("says why a tile cannot be picked, and its key does nothing", async () => {
    render(<Picker start="cash" />);
    const link = screen.getByRole("radio", { name: /Payment link/ });
    expect(link).toBeDisabled();
    expect(link).toHaveTextContent("Coming soon");
    await userEvent.keyboard("4");
    expect(link).toHaveAttribute("aria-checked", "false");
  });

  it("announces each tile's shortcut", () => {
    render(<Picker />);
    expect(screen.getByRole("radio", { name: /Card/ })).toHaveAttribute("aria-keyshortcuts", "2");
  });
});
