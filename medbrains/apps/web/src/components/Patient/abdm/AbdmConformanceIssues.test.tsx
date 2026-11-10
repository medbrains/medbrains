import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AbdmConformanceIssues } from "./AbdmConformanceIssues";

describe("AbdmConformanceIssues", () => {
  it("says a record went out off-standard, with every rule it broke", () => {
    render(
      <AbdmConformanceIssues
        issues={[
          "OPConsultRecord: Composition.encounter is required",
          "MedicationRequest x: MedicationRequest.requester is required",
        ]}
      />,
    );
    expect(screen.getByText("Sent, but not to the FHIR standard")).toBeInTheDocument();
    expect(screen.getByText(/Composition.encounter is required/)).toBeInTheDocument();
    expect(screen.getByText(/MedicationRequest.requester is required/)).toBeInTheDocument();
  });

  it("shows nothing for a record that was sent clean", () => {
    render(<AbdmConformanceIssues issues={[]} />);
    expect(screen.queryByTestId("abdm-conformance-issues")).not.toBeInTheDocument();
  });
});
