import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { MlcSignal } from "./mlc-signal";

// The test i18n has no resources, so a label renders as its key.
describe("a visit's medico-legal mark", () => {
  it("names a possible MLC waiting for a doctor, apart from a registered one", () => {
    render(<MlcSignal visit={{ is_mlc: false, mlc_suspicion: "suspected" }} />);
    const mark = screen.getByText("signals.mlcSuspected");
    expect(mark.parentElement).toHaveAttribute("data-shape", "token");
    expect(screen.queryByText("signals.mlc")).not.toBeInTheDocument();
  });

  it("shows the registered mark once confirmed, and nothing once dismissed", () => {
    render(<MlcSignal visit={{ is_mlc: true, mlc_suspicion: "confirmed" }} />);
    expect(screen.getByText("signals.mlc").parentElement).toHaveAttribute("data-shape", "diamond");
    render(<MlcSignal visit={{ is_mlc: false, mlc_suspicion: "dismissed" }} />);
    expect(screen.getAllByText(/^signals\.mlc/)).toHaveLength(1);
  });
});
