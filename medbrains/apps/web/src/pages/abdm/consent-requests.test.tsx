import { usePermissionStore } from "@medbrains/stores";
import { type AbdmConsentRequest, P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import AbdmConsentRequestsPage from "./consent-requests";

const list = vi.fn();
vi.mock("@/services/abdmRecords.service", () => ({
  abdmRecordsService: { consentRequests: (p: unknown) => list(p) },
}));

const row = (over: Partial<AbdmConsentRequest>): AbdmConsentRequest => ({
  id: "r1",
  patient_id: "p1",
  patient_name: "Meena Iyer",
  uhid: "UH-0001",
  abha_address: "meena@sbx",
  abha_number: "91-1234-5678-9012",
  purpose_code: "CAREMGT",
  hi_types: ["OPConsultation", "Prescription"],
  date_from: "2024-01-01T00:00:00Z",
  date_to: "2026-11-01T00:00:00Z",
  data_erase_at: "2026-12-01T00:00:00Z",
  status: "awaiting_patient",
  error: null,
  requester_name: "Dr. Asha Rao",
  requested_at: "2026-11-10T05:00:00Z",
  status_at: "2026-11-10T05:00:02Z",
  status_checked_at: null,
  granted_at: null,
  granted_hi_types: null,
  granted_from: null,
  granted_to: null,
  granted_erase_at: null,
  records_received: 0,
  records_held: 0,
  ...over,
});

const page = (data: AbdmConsentRequest[]) => ({
  data,
  meta: { total: data.length, page: 1, limit: 50 },
});

// HIU_FLOW_104 / 106 / 301: the hospital-wide consent list.
describe("AbdmConsentRequestsPage", () => {
  beforeEach(() => {
    list.mockReset();
    usePermissionStore.getState().setPermissions("mrd_officer", [P.ABDM.CONSENT.LIST]);
  });

  it("never asks for the list without abdm.consent.list", () => {
    usePermissionStore.getState().setPermissions("nurse", [P.ABDM.CONSENT.VIEW]);
    render(<AbdmConsentRequestsPage />);
    expect(list).not.toHaveBeenCalled();
  });

  it("shows a failed load as a failure, never as no requests", async () => {
    list.mockRejectedValue(new Error("503"));
    render(<AbdmConsentRequestsPage />);
    expect(await screen.findByText(/does not mean there are none/)).toBeInTheDocument();
    expect(screen.queryByText(/No consent request has been raised/)).not.toBeInTheDocument();
  });

  it("says so when the hospital has raised none", async () => {
    list.mockResolvedValue(page([]));
    render(<AbdmConsentRequestsPage />);
    expect(await screen.findByText(/No consent request has been raised yet/)).toBeInTheDocument();
  });

  it("shows the patient, ABHA number and address, and the time of the status", async () => {
    list.mockResolvedValue(page([row({})]));
    render(<AbdmConsentRequestsPage />);
    expect(await screen.findByText("Meena Iyer")).toBeInTheDocument();
    expect(screen.getByText("91-1234-5678-9012")).toBeInTheDocument();
    expect(screen.getByText("meena@sbx")).toBeInTheDocument();
    expect(screen.getByText("Asked for")).toBeInTheDocument();
    expect(screen.getAllByText(/Waiting for the patient/).length).toBeGreaterThan(1);
  });

  it("shows the scope the patient granted, not the one asked for", async () => {
    list.mockResolvedValue(
      page([
        row({
          status: "granted",
          granted_at: "2026-11-10T06:00:00Z",
          granted_hi_types: ["OPConsultation"],
          granted_from: "2025-01-01T00:00:00Z",
          granted_to: "2025-06-30T00:00:00Z",
          granted_erase_at: "2026-11-20T00:00:00Z",
        }),
      ]),
    );
    render(<AbdmConsentRequestsPage />);
    expect(await screen.findByText("Granted", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("OP consultation")).toBeInTheDocument();
    expect(screen.getByText("Asked for OP consultation, Prescription")).toBeInTheDocument();
  });

  it("shows an unanswered request as expired with nothing shared", async () => {
    list.mockResolvedValue(page([row({ status: "expired", status_at: "2026-12-01T00:00:00Z" })]));
    render(<AbdmConsentRequestsPage />);
    expect(await screen.findByText(/did not answer before it expired/)).toBeInTheDocument();
    expect(screen.queryByText(/records received were erased/)).not.toBeInTheDocument();
  });
});
