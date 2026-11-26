import { usePermissionStore } from "@medbrains/stores";
import type { ErVisit } from "@medbrains/types";
import { P } from "@medbrains/types";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { SuspectedMlcAlert } from "./suspected-mlc-alert";

const visit = (extra: Partial<ErVisit>) =>
  ({ id: "v1", is_mlc: false, mlc_suspected_type: "road_traffic_accident", ...extra }) as ErVisit;
const suspected = visit({ mlc_suspicion: "suspected" });

afterEach(() => usePermissionStore.getState().clearPermissions());

describe("a possible MLC on the ER visit", () => {
  it("tells a nurse who decides, and offers her no control", () => {
    usePermissionStore.getState().setPermissions("nurse", [P.EMERGENCY.TRIAGE_CREATE]);
    render(<SuspectedMlcAlert visit={suspected} />);
    expect(screen.getByText("Possible medico-legal case: doctor to confirm")).toBeInTheDocument();
    expect(screen.getByText("A doctor confirms or dismisses this.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Confirm only with the permission to register a case", () => {
    usePermissionStore.getState().setPermissions("doctor", [P.EMERGENCY.MLC_REVIEW_SUSPECTED]);
    render(<SuspectedMlcAlert visit={suspected} />);
    expect(screen.getByRole("button", { name: "Not a medico-legal case" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm MLC" })).not.toBeInTheDocument();
  });

  it("keeps a dismissal on the page with its reason, and says nothing otherwise", () => {
    render(
      <SuspectedMlcAlert
        visit={visit({ mlc_suspicion: "dismissed", mlc_suspicion_reason: "Fell at home" })}
      />,
    );
    expect(screen.getByText("Fell at home")).toBeInTheDocument();
    render(<SuspectedMlcAlert visit={visit({ mlc_suspicion: null })} />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("says nothing once an MLC case is registered, even over an earlier dismissal", () => {
    render(
      <SuspectedMlcAlert
        visit={visit({ is_mlc: true, mlc_suspicion: "dismissed", mlc_suspicion_reason: "Fell" })}
      />,
    );
    expect(screen.queryByText("Reviewed: not a medico-legal case")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
