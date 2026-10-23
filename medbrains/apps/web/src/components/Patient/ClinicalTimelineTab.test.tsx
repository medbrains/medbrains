import { usePermissionStore } from "@medbrains/stores";
import type { PatientTimelineEvent } from "@medbrains/types";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ClinicalTimelineTab } from "./ClinicalTimelineTab";

const service = vi.hoisted(() => ({ getClinicalTimeline: vi.fn() }));
vi.mock("@/services/patientDetail.service", () => ({ patientDetailService: service }));

const PATIENT = "22222222-2222-4222-8222-222222222222";

function event(over: Partial<PatientTimelineEvent>): PatientTimelineEvent {
  return {
    occurred_at: new Date().toISOString(),
    category: "diagnosis",
    title: "Type 2 diabetes",
    subtitle: "E11",
    ref_id: "d1",
    withheld: false,
    ...over,
  };
}

describe("Clinical timeline — mental-health tombstones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionStore.getState().setPermissions("doctor", [P.AUDIT.BREAK_GLASS_START]);
  });

  // Given a schizophrenia diagnosis the viewer may not see, the server sends
  // a withheld row; the screen shows that an entry exists and nothing more,
  // with the emergency route offered to a role that may break the glass.
  it("renders a withheld entry as a tombstone with emergency access", async () => {
    service.getClinicalTimeline.mockResolvedValue([
      event({ ref_id: "d2", title: "Restricted entry", subtitle: null, withheld: true }),
      event({}),
    ]);
    render(<ClinicalTimelineTab patientId={PATIENT} />);
    expect(await screen.findByText("Restricted entry")).toBeInTheDocument();
    expect(screen.getByText("Type 2 diabetes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emergency access" })).toBeInTheDocument();
  });

  it("an outage is an error, not 'no clinical activity'", async () => {
    service.getClinicalTimeline.mockRejectedValue(new Error("503"));
    render(<ClinicalTimelineTab patientId={PATIENT} />);
    expect(await screen.findByText("The timeline could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText(/No clinical activity/)).not.toBeInTheDocument();
  });
});
