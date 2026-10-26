import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PatientFlowHub } from "./patient-flow-hub";

const all = {
  canRegisterPatient: true,
  canCreateOpdVisit: true,
  canViewOpdQueue: true,
  canViewAnyTokenBoard: true,
  canCreateEmergencyVisit: true,
  canViewEmergency: true,
  canViewCamp: true,
  canCreateCampRegistration: true,
  canViewBilling: true,
  canCreateBilling: true,
  canViewPharmacy: true,
  canViewIndent: true,
  canViewProcurementStores: true,
  canViewAssets: true,
  canViewIpd: true,
  canCreateIpdAdmission: true,
};

describe("PatientFlowHub", () => {
  it("shows reception what each step does, not its permission codes or event names", () => {
    render(<PatientFlowHub navigate={vi.fn()} {...all} />);
    expect(screen.getByText("Register Patient")).toBeInTheDocument();
    expect(screen.queryByText(/Permission:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^emits /i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Standards:/)).not.toBeInTheDocument();
  });
});
