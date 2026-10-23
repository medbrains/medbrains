import { usePermissionStore } from "@medbrains/stores";
import { type AbdmPatientRecords, P } from "@medbrains/types";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AbdmSmsLinkPanel } from "./AbdmSmsLinkPanel";

const records = (over: Partial<AbdmPatientRecords>): AbdmPatientRecords => ({
  configured: true,
  abha_verified: false,
  hip_id: "IN2410000001",
  blocked_reason: null,
  phone_on_file: true,
  sms_link: null,
  care_contexts: [],
  consents: [],
  transfers: [],
  ...over,
});

// HIP_INIT_NOTIFY_HIECM: the ABHA app link, for a patient with no ABHA here.
describe("AbdmSmsLinkPanel", () => {
  beforeEach(() => {
    usePermissionStore.getState().setPermissions("receptionist", [P.ABDM.RECORDS.NOTIFY]);
  });

  it("is not offered for a patient whose ABHA is already here", () => {
    render(<AbdmSmsLinkPanel patientId="p1" records={records({ abha_verified: true })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows ABDM's answer in words, and offers to send again", () => {
    render(
      <AbdmSmsLinkPanel
        patientId="p1"
        records={records({
          sms_link: {
            status: "failed",
            phone_last4: "3210",
            error: "ABDM's SMS service is down, so no SMS could be sent. (code ABDM-1004)",
            automatic: true,
            created_at: "2026-10-23T05:00:00Z",
            answered_at: "2026-10-23T05:00:02Z",
          },
        })}
      />,
    );
    expect(screen.getByText("Not sent")).toBeInTheDocument();
    expect(screen.getByText(/SMS service is down/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text the ABHA app link again" })).toBeEnabled();
  });

  it("cannot send without a mobile number, and says so", () => {
    render(<AbdmSmsLinkPanel patientId="p1" records={records({ phone_on_file: false })} />);
    expect(screen.getByRole("button", { name: "Text the ABHA app link" })).toBeDisabled();
    expect(screen.getByText(/Add the patient's mobile number/)).toBeInTheDocument();
  });

  it("offers nothing to staff without the permission", () => {
    usePermissionStore.getState().setPermissions("receptionist", []);
    render(<AbdmSmsLinkPanel patientId="p1" records={records({})} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
