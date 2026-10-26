// The early-warning signals on a ward card: the latest score and its trend,
// when the next set is due (overdue stands out), and an open escalation.

import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type EwsBand, P, type PatientCardRow } from "@medbrains/types";
import {
  IconBellRinging,
  IconClockExclamation,
  IconHeartbeat,
  IconLungs,
} from "@tabler/icons-react";
import { OperationalSignal, type OperationalSignalTone } from "@/components";
import { Button } from "@/components/ui";
import { EwsPlanModal } from "./EwsPlanModal";
import {
  DUE_LABEL,
  EWS_BAND_LABEL,
  EWS_TOOL_LABEL,
  ewsDueState,
  ewsTotalText,
} from "./ews-display";

const BAND_SIGNAL: Record<EwsBand, OperationalSignalTone> = {
  routine: "ready",
  low: "neutral",
  low_medium: "blocked",
  urgent: "risk",
  emergency: "risk",
};

export function EwsCardSignals({ patient }: { patient: PatientCardRow }) {
  const canPlan = useHasPermission(P.NURSE.EWS.PLAN);
  const [planOpened, plan] = useDisclosure(false);
  const { ews_tool: tool, ews_total: total, ews_band: band } = patient;
  const due = patient.ews_next_due_at ? ewsDueState(patient.ews_next_due_at) : null;
  return (
    <>
      {tool && band && total != null ? (
        <OperationalSignal
          icon={IconHeartbeat}
          label={`${EWS_TOOL_LABEL[tool]} · ${EWS_BAND_LABEL[band]}`}
          shape="diamond"
          size="xs"
          tone={BAND_SIGNAL[band]}
          value={`${ewsTotalText(total, Boolean(patient.ews_incomplete))}${
            patient.ews_trend.length > 1 ? ` (trend ${patient.ews_trend.join(" → ")})` : ""
          }`}
        />
      ) : (
        <OperationalSignal
          label="Early-warning score"
          shape="diamond"
          size="xs"
          value="Not scored"
        />
      )}
      {due && due !== "scheduled" && patient.ews_next_due_at && (
        <OperationalSignal
          icon={IconClockExclamation}
          label={DUE_LABEL[due]}
          shape="diamond"
          size="xs"
          tone={due === "overdue" ? "risk" : "blocked"}
          value={new Date(patient.ews_next_due_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      )}
      {patient.open_escalation_band && (
        <OperationalSignal
          icon={IconBellRinging}
          label="Escalated — awaiting acknowledgement"
          shape="diamond"
          size="xs"
          tone="risk"
          value={EWS_BAND_LABEL[patient.open_escalation_band]}
        />
      )}
      {canPlan && (
        <>
          <Button tone="ghost" size="xs" leftSection={<IconLungs size={14} />} onClick={plan.open}>
            Scoring plan
          </Button>
          {planOpened && (
            <EwsPlanModal
              encounterId={patient.encounter_id}
              opened={planOpened}
              onClose={plan.close}
            />
          )}
        </>
      )}
    </>
  );
}
