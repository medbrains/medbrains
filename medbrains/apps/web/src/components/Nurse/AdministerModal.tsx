import { Group, Stack, Text, Textarea } from "@mantine/core";
import type { MarDueRow, MarStatus, SetupUser, UpdateMarRoundInput } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Modal,
  SegmentedControl,
  Select,
  toast,
} from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";

interface Props {
  opened: boolean;
  onClose: () => void;
  dose: MarDueRow;
  isSubmitting: boolean;
  onSubmit: (input: UpdateMarRoundInput) => void;
}

type Mode = "give" | "hold" | "refuse" | "missed";

const MODE_STATUS: Record<Mode, MarStatus> = {
  give: "given",
  hold: "held",
  refuse: "refused",
  missed: "missed",
};

/**
 * Bedside administration — enforces the 5 Rights before a dose can be given,
 * a second-nurse witness for high-alert drugs, and a mandatory reason when a
 * dose is held / refused / missed. Mirrors the pharmacy DispenseModal's witness
 * pattern.
 */
export function AdministerModal({ opened, onClose, dose, isSubmitting, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>("give");
  const [patientChecked, setPatientChecked] = useState(false);
  const [drugChecked, setDrugChecked] = useState(false);
  const [doseChecked, setDoseChecked] = useState(false);
  const [witness, setWitness] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
    enabled: opened && dose.is_high_alert,
  });

  const fiveRightsOk = patientChecked && drugChecked && doseChecked;
  const witnessMissing = dose.is_high_alert && !witness;
  const reasonMissing = mode !== "give" && !reason.trim();

  const canSubmit = useMemo(() => {
    if (mode === "give") return fiveRightsOk && !witnessMissing;
    return !reasonMissing;
  }, [mode, fiveRightsOk, witnessMissing, reasonMissing]);

  const submit = () => {
    if (mode === "give" && witnessMissing) {
      toast.error("A second-nurse witness is required for a high-alert drug.", {
        title: "Witness needed",
      });
      return;
    }
    const input: UpdateMarRoundInput = { status: MODE_STATUS[mode] };
    if (mode === "give") {
      input.barcode_verified = patientChecked && drugChecked;
      if (witness) input.witnessed_by = witness;
    } else if (mode === "hold") {
      input.hold_reason = reason.trim();
    } else if (mode === "refuse") {
      input.refused_reason = reason.trim();
    } else {
      input.missed_reason = reason.trim();
    }
    onSubmit(input);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Administer medication" size="md">
      <Stack gap="sm">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600}>{dose.drug_name}</Text>
            {dose.is_high_alert && (
              <Badge tone="danger" size="sm">
                High alert
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {dose.dose} · {dose.route} · for {dose.patient_name}
          </Text>
          {dose.batch_number && (
            <Text size="xs" c="dimmed">
              Batch {dose.batch_number}
              {dose.batch_expiry ? ` · exp ${dose.batch_expiry}` : ""}
            </Text>
          )}
        </Stack>

        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          data={[
            { label: "Give", value: "give" },
            { label: "Hold", value: "hold" },
            { label: "Refuse", value: "refuse" },
            { label: "Missed", value: "missed" },
          ]}
        />

        {mode === "give" ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Confirm the 5 Rights
            </Text>
            <Checkbox
              label={`Right patient — verified ${dose.patient_name} (2-ID / wristband)`}
              checked={patientChecked}
              onChange={(e) => setPatientChecked(e.currentTarget.checked)}
            />
            <Checkbox
              label={`Right drug — label matches ${dose.drug_name}`}
              checked={drugChecked}
              onChange={(e) => setDrugChecked(e.currentTarget.checked)}
            />
            <Checkbox
              label={`Right dose / route / time — ${dose.dose}, ${dose.route}`}
              checked={doseChecked}
              onChange={(e) => setDoseChecked(e.currentTarget.checked)}
            />
            {dose.is_high_alert && (
              <Select
                label="Witness (second nurse — required for high-alert)"
                placeholder="Select witness"
                data={(users as SetupUser[]).map((u) => ({ value: u.id, label: u.full_name }))}
                value={witness}
                onChange={setWitness}
                searchable
                error={witnessMissing ? "Required for high-alert drugs" : undefined}
              />
            )}
          </Stack>
        ) : (
          <Textarea
            label="Reason"
            placeholder={
              mode === "hold"
                ? "e.g. patient NPO for procedure"
                : mode === "refuse"
                  ? "e.g. patient declined"
                  : "e.g. patient off ward"
            }
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={2}
            required
          />
        )}

        {mode !== "give" && (
          <Alert tone="info">The prescriber is notified when a dose is not given.</Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" loading={isSubmitting} disabled={!canSubmit} onClick={submit}>
            {mode === "give" ? "Give dose" : "Confirm"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
