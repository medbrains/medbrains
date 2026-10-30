import type { GroupCandidate } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { GroupCandidateTable } from "./GroupCandidateTable";

const candidate: GroupCandidate = {
  candidate_id: "c1",
  id: "p2",
  uhid: "UH-E-9",
  first_name: "Minakshi",
  last_name: "Sundaram",
  date_of_birth: "1971-02-14",
  phone: "",
  gender: "female",
  score: 0.99,
  pharmacy_customer: false,
  band: "likely",
  reasons: ["Name matches in another spelling", "Date of birth matches"],
  hospital: "Sunrise East",
  status: "pending",
  created_at: "2026-10-30T05:00:00Z",
  local_patient_id: "p1",
};

describe("GroupCandidateTable", () => {
  it("shows the other hospital, why, and asks a person to decide", async () => {
    const onDecide = vi.fn();
    render(<GroupCandidateTable candidates={[candidate]} onDecide={onDecide} />);
    expect(screen.getByText("Sunrise East")).toBeInTheDocument();
    expect(screen.getByText("Likely same")).toBeInTheDocument();
    expect(screen.getByText("Name matches in another spelling")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not the same" }));
    expect(onDecide).toHaveBeenCalledWith(candidate, "reject");
  });

  it("only reads without the link permission", () => {
    render(<GroupCandidateTable candidates={[candidate]} />);
    expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
  });
});
