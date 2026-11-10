import { Button } from "@mantine/core";
import type { DischargeMedicine } from "@medbrains/types";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { DischargeMedicinesEditor } from "./discharge-medicines-editor";

// The formulary picker fetches the catalogue; here it offers one drug.
vi.mock("@/components/DrugSearchSelect", () => ({
  DrugSearchSelect: ({ onChange }: { onChange: (id: string, drug?: { name: string }) => void }) => (
    <Button onClick={() => onChange("cat-1", { name: "Paracetamol 500 mg" })}>
      Pick paracetamol
    </Button>
  ),
}));

const seen = vi.hoisted(() => ({ last: [] as DischargeMedicine[] }));

/** Holds the list the way the discharge summary does, recording each change. */
function Harness({ initial = [] }: { initial?: DischargeMedicine[] }) {
  const [value, setValue] = useState(initial);
  return (
    <DischargeMedicinesEditor
      value={value}
      onChange={(next) => {
        seen.last = next;
        setValue(next);
      }}
    />
  );
}

describe("medicines on discharge", () => {
  it("adds a formulary drug once, with its catalogue id for the pharmacy", async () => {
    render(<Harness />);
    const pick = screen.getByRole("button", { name: "Pick paracetamol" });
    await userEvent.click(pick);
    await userEvent.click(pick);
    expect(seen.last).toEqual([
      { catalog_item_id: "cat-1", drug_name: "Paracetamol 500 mg", quantity: 1 },
    ]);
  });

  it("marks a typed medicine as bought outside, with no catalogue id", async () => {
    render(<Harness />);
    const add = screen.getByRole("button", { name: "Add as buy outside" });
    expect(add).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Not stocked here: buy outside"),
      "  Insulin glargine  ",
    );
    await userEvent.click(add);
    expect(seen.last).toEqual([{ buy_outside: true, drug_name: "Insulin glargine", quantity: 1 }]);
    expect(screen.getByText("Buy from outside the hospital")).toBeInTheDocument();
  });

  it("records how to take it and removes a row", async () => {
    render(
      <Harness initial={[{ catalog_item_id: "cat-1", drug_name: "Paracetamol", quantity: 10 }]} />,
    );
    await userEvent.type(screen.getByLabelText("How to take"), "after food");
    expect(seen.last[0]?.instructions).toBe("after food");
    await userEvent.click(screen.getByRole("button", { name: "Remove Paracetamol" }));
    expect(seen.last).toEqual([]);
  });

  it("stops offering more at the 50 the server accepts", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      catalog_item_id: `c${i}`,
      drug_name: `Drug ${i}`,
      quantity: 1,
    }));
    render(<Harness initial={fifty} />);
    expect(screen.queryByRole("button", { name: "Pick paracetamol" })).toBeNull();
  });
});
