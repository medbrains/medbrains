import type { PharmacyDispenseContext } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DispensePatientCard } from "./dispense-patient-card";

const patient = (extra: Partial<PharmacyDispenseContext>): PharmacyDispenseContext => ({
  patient_id: "p1",
  uhid: "UH-001",
  full_name: "Ravi Kumar",
  no_known_allergies: null,
  drug_allergies: [],
  ...extra,
});

describe("the patient card at the dispensing counter", () => {
  it("reports a failed read as a fault, never as a clean allergy record", () => {
    render(<DispensePatientCard context={patient({})} loading={false} failed />);
    expect(screen.getByText("Allergies could not be read")).toBeInTheDocument();
    expect(screen.queryByText(/No known drug allergies/)).toBeNull();
  });

  it("tells a recorded 'no known allergies' apart from never asked", () => {
    const { rerender } = render(
      <DispensePatientCard
        context={patient({ no_known_allergies: true })}
        loading={false}
        failed={false}
      />,
    );
    expect(screen.getByText("No known drug allergies (recorded)")).toBeInTheDocument();
    rerender(<DispensePatientCard context={patient({})} loading={false} failed={false} />);
    expect(screen.getByText(/none has been noted as asked/)).toBeInTheDocument();
  });

  it("names each drug allergy with its severity", () => {
    const context = patient({
      drug_allergies: [{ allergen_name: "Penicillin", severity: "severe", reaction: null }],
    });
    render(<DispensePatientCard context={context} loading={false} failed={false} />);
    expect(screen.getByText("Ravi Kumar · UH-001")).toBeInTheDocument();
    expect(screen.getByText("Penicillin (severe)")).toBeInTheDocument();
  });

  it("says it is still reading rather than showing an empty list", () => {
    render(<DispensePatientCard context={undefined} loading failed={false} />);
    expect(screen.getByText(/Reading the patient's allergies/)).toBeInTheDocument();
  });
});
