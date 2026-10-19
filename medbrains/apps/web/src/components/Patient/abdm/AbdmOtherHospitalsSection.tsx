import { Loader, Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Panel } from "@/components/ui";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { ConsentRequestModal } from "./ConsentRequestModal";
import { ConsentRequestTable } from "./ConsentRequestTable";
import { ReceivedRecordsList } from "./ReceivedRecordsList";
import { ReceivedRecordViewer } from "./ReceivedRecordViewer";

interface AbdmOtherHospitalsSectionProps {
  patientId: string;
}

/**
 * Patient chart → records from other hospitals (ABDM HIU): consent requests
 * and what other facilities sent under them. Hidden — and never fetched —
 * without `abdm.consent.view`; requesting needs `abdm.consent.request`.
 */
export function AbdmOtherHospitalsSection({ patientId }: AbdmOtherHospitalsSectionProps) {
  const canView = useHasPermission(P.ABDM.CONSENT.VIEW);
  const canRequest = useHasPermission(P.ABDM.CONSENT.REQUEST);
  const [asking, setAsking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["abdm", "received-records", patientId],
    queryFn: () => abdmRecordsService.receivedRecords(patientId),
    enabled: canView,
  });

  if (!canView) return null;
  const canAsk = canRequest && data !== undefined && data.blocked_reason === null;

  return (
    <Panel
      title="Records from other hospitals"
      description="Records held elsewhere, shared through ABDM with the patient's consent."
      actions={
        canAsk ? (
          <Button tone="primary" size="xs" onClick={() => setAsking(true)}>
            Request records
          </Button>
        ) : undefined
      }
    >
      {isLoading && <Loader size="sm" />}
      {isError && (
        <Alert tone="danger" title="Could not load records from other hospitals">
          This does not mean there are none — the list failed to load.
        </Alert>
      )}
      {data && (
        <Stack gap="md">
          {data.blocked_reason && (
            <Alert tone="warning" title="Records cannot be requested">
              {data.blocked_reason}
            </Alert>
          )}
          <Panel title="Requests" bare>
            <ConsentRequestTable
              patientId={patientId}
              requests={data.requests}
              canCheck={canRequest}
            />
          </Panel>
          <Panel title="Records received" bare>
            <ReceivedRecordsList records={data.records} onOpen={setOpenId} />
          </Panel>
        </Stack>
      )}
      {canRequest && (
        <ConsentRequestModal
          patientId={patientId}
          opened={asking}
          onClose={() => setAsking(false)}
        />
      )}
      <ReceivedRecordViewer recordId={openId} onClose={() => setOpenId(null)} />
    </Panel>
  );
}
