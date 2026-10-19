import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@/components/ui";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { CONSENT_REQUEST_STATUS } from "./abdmStatus";

interface CheckConsentStatusButtonProps {
  patientId: string;
  requestId: string;
}

/**
 * Ask ABDM where a consent request stands, for one whose answer never
 * arrived. The status changes when ABDM replies; the list reloads either way.
 */
export function CheckConsentStatusButton({ patientId, requestId }: CheckConsentStatusButtonProps) {
  const qc = useQueryClient();
  const check = useMutation({
    mutationFn: () => abdmRecordsService.checkConsentStatus(requestId),
    onSuccess: (row) => {
      toast.info(CONSENT_REQUEST_STATUS[row.status].label, { title: "Status checked with ABDM" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not check the status" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["abdm", "received-records", patientId] });
    },
  });
  return (
    <Button
      tone="secondary"
      size="xs"
      leftSection={<IconRefresh size={16} aria-hidden />}
      loading={check.isPending}
      onClick={() => check.mutate()}
    >
      Check status
    </Button>
  );
}
