import { Loader, Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Panel, toast } from "@/components/ui";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { AbdmCareContextTable } from "./AbdmCareContextTable";
import { AbdmConsentTable } from "./AbdmConsentTable";
import { AbdmTransferTable } from "./AbdmTransferTable";
import { AbhaOptOutModal } from "./AbhaOptOutModal";

interface AbdmRecordsSectionProps {
  patientId: string;
}

/**
 * Patient chart → ABDM records: which finalised records are linked to the
 * patient's ABHA, why one is not, the consents received and every transfer.
 * Hidden — and never fetched — without `abdm.records.view`.
 */
export function AbdmRecordsSection({ patientId }: AbdmRecordsSectionProps) {
  const canView = useHasPermission(P.ABDM.RECORDS.VIEW);
  const canManage = useHasPermission(P.ABDM.RECORDS.MANAGE);
  const canUnlink = useHasPermission(P.ABDM.ABHA.UNLINK);
  const [optingOut, setOptingOut] = useState(false);
  const queryClient = useQueryClient();
  const key = ["abdm", "patient-records", patientId];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => abdmRecordsService.patientRecords(patientId),
    enabled: canView,
  });
  const link = useMutation({
    mutationFn: abdmRecordsService.link,
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: key });
      if (row.link_status === "failed") {
        toast.error(row.last_error ?? "ABDM did not accept the link.", { title: "Not linked" });
      } else {
        toast.success("ABDM will confirm the link shortly.", { title: "Sent to ABDM" });
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not link the record" }),
  });

  if (!canView) return null;

  return (
    <Panel
      title="ABDM records"
      description="Finalised records this hospital shares with the patient's ABHA."
      actions={
        canUnlink && data?.abha_verified ? (
          <Button tone="danger-ghost" size="xs" onClick={() => setOptingOut(true)}>
            Opt out of ABDM…
          </Button>
        ) : undefined
      }
    >
      <AbhaOptOutModal
        patientId={patientId}
        opened={optingOut}
        onClose={() => setOptingOut(false)}
      />
      {isLoading && <Loader size="sm" />}
      {isError && (
        <Alert tone="danger" title="Could not load ABDM records">
          This does not mean nothing is linked — the records failed to load.
        </Alert>
      )}
      {data && (
        <Stack gap="md">
          {data.blocked_reason && (
            <Alert tone="warning" title="Records are not being linked">
              {data.blocked_reason}
            </Alert>
          )}
          <AbdmCareContextTable
            contexts={data.care_contexts}
            onLink={canManage && !data.blocked_reason ? (id) => link.mutate(id) : undefined}
            linkingId={link.isPending ? link.variables : null}
          />
          <Panel title="Consents received" bare>
            <AbdmConsentTable consents={data.consents} />
          </Panel>
          <Panel title="Records sent" bare>
            <AbdmTransferTable transfers={data.transfers} />
          </Panel>
        </Stack>
      )}
    </Panel>
  );
}
