// Pharmacy PharmacyReturnsWorkspace — split from pharmacy.tsx (pure move).

import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import { CreditNotesTab } from "@/components/Pharmacy/CreditNotesTab";
import { PharmacyReturnsTab } from "./returns";
import type { ReturnWorkspaceMode } from "./shared";
import { isReturnWorkspaceMode } from "./shared";

export function PharmacyReturnsWorkspace({
  canViewQueue,
  canViewCreditNoteQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canSettleCreditNote,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canViewCreditNoteQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canSettleCreditNote: boolean;
  canViewPatientRecord: boolean;
}) {
  const [mode, setMode] = useState<ReturnWorkspaceMode>("medicine-returns");

  return (
    <Stack>
      <SegmentedControl
        size="xs"
        value={mode}
        onChange={(value) => {
          if (isReturnWorkspaceMode(value)) setMode(value);
        }}
        data={[
          { value: "medicine-returns", label: "Dispensed item returns" },
          { value: "credit-notes", label: "Custom credit notes" },
        ]}
      />
      {mode === "medicine-returns" ? (
        <PharmacyReturnsTab
          canViewQueue={canViewQueue}
          canRequest={canRequest}
          canApprove={canApprove}
          canVoidDispensing={canVoidDispensing}
          canRestock={canRestock}
          canDestroy={canDestroy}
          canReject={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      ) : (
        <CreditNotesTab
          canViewQueue={canViewCreditNoteQueue}
          canCreate={canRequest}
          canApprove={canApprove}
          canSettle={canSettleCreditNote}
          canCancel={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      )}
    </Stack>
  );
}
