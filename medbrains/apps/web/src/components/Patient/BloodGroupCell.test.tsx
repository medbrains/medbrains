import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { BloodGroupCell } from "./BloodGroupCell";

describe("the patient list's blood group cell", () => {
  it("shows the recorded blood group", () => {
    render(<BloodGroupCell value="b_positive" />);
    expect(screen.getByText("B+")).toBeInTheDocument();
  });

  it("shows — when none is recorded, or the answer was not known", () => {
    const { rerender } = render(<BloodGroupCell value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<BloodGroupCell value="unknown" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows — for a value the server withheld, never a guess", () => {
    // A withheld field arrives as null; nothing in the cell infers it.
    render(<BloodGroupCell value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/[ABO]+[+-]/)).not.toBeInTheDocument();
  });
});
