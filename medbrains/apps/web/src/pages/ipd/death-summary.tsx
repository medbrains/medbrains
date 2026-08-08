// IPD DeathSummaryTab — split from ipd.tsx (pure move).

import {
  Card,
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDeathSummaryRequest,
  DeathCertFormType,
  IpdDeathSummary,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function DeathSummaryTab({
  admissionId,
  patientId,
  status,
}: {
  admissionId: string;
  patientId: string;
  status: string;
}) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [timeOfDeath, setTimeOfDeath] = useState("");
  const [causePrimary, setCausePrimary] = useState("");
  const [causeSecondary, setCauseSecondary] = useState("");
  const [causeUnderlying, setCauseUnderlying] = useState("");
  const [mannerOfDeath, setMannerOfDeath] = useState("");
  const [formType, setFormType] = useState<string | null>("form_4");
  const [autopsyRequested, setAutopsyRequested] = useState(false);
  const [isMedicoLegal, setIsMedicoLegal] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [dsNotes, setDsNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-death-summary", admissionId],
    queryFn: () => ipdService.getDeathSummary(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateDeathSummaryRequest) => ipdService.createDeathSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-death-summary", admissionId] });
      toast.success("Death summary recorded", { title: "Created" });
      formHandlers.close();
    },
  });

  const summary = data as IpdDeathSummary | null | undefined;

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (summary) {
    return (
      <Stack>
        <Text fw={600}>Death Summary</Text>
        <Card withBorder p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed">
                Date of Death
              </Text>
              <Text fw={500}>{summary.date_of_death}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Time of Death
              </Text>
              <Text fw={500}>{summary.time_of_death}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Primary Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_primary ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Secondary Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_secondary ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Underlying Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_underlying ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Manner of Death
              </Text>
              <Text size="sm">{summary.manner_of_death ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Form Type
              </Text>
              <Badge size="sm">
                {summary.form_type === "form_4"
                  ? "Form 4 (Institutional)"
                  : "Form 4a (Non-Institutional)"}
              </Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Flags
              </Text>
              <Group gap={4}>
                {summary.autopsy_requested && (
                  <Badge size="xs" tone="warning">
                    Autopsy Requested
                  </Badge>
                )}
                {summary.is_medico_legal && (
                  <Badge size="xs" tone="danger">
                    Medico-Legal
                  </Badge>
                )}
              </Group>
            </div>
          </SimpleGrid>
          {summary.notes && (
            <div>
              <Text size="xs" c="dimmed" mt="xs">
                Notes
              </Text>
              <Text size="sm">{summary.notes}</Text>
            </div>
          )}
        </Card>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Death Summary</Text>
        {canCreate && status === "deceased" && !formOpened && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Create Death Summary
          </Button>
        )}
      </Group>

      {status !== "deceased" && (
        <Text size="sm" c="dimmed">
          Death summary is only applicable for deceased patients.
        </Text>
      )}

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Date of Death"
                type="date"
                value={dateOfDeath}
                onChange={(e) => setDateOfDeath(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Time of Death"
                type="time"
                value={timeOfDeath}
                onChange={(e) => setTimeOfDeath(e.currentTarget.value)}
                required
              />
            </SimpleGrid>
            <TextInput
              label="Primary Cause of Death (ICD)"
              value={causePrimary}
              onChange={(e) => setCausePrimary(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Secondary Cause"
              value={causeSecondary}
              onChange={(e) => setCauseSecondary(e.currentTarget.value)}
            />
            <TextInput
              label="Underlying Cause"
              value={causeUnderlying}
              onChange={(e) => setCauseUnderlying(e.currentTarget.value)}
            />
            <TextInput
              label="Manner of Death"
              value={mannerOfDeath}
              onChange={(e) => setMannerOfDeath(e.currentTarget.value)}
              placeholder="Natural / Accident / Suicide / Homicide / Undetermined"
            />
            <Select
              label="Certificate Form"
              data={[
                { value: "form_4", label: "Form 4 (Institutional)" },
                { value: "form_4a", label: "Form 4a (Non-Institutional)" },
              ]}
              value={formType}
              onChange={setFormType}
            />
            <Group>
              <Checkbox
                label="Autopsy Requested"
                checked={autopsyRequested}
                onChange={(e) => setAutopsyRequested(e.currentTarget.checked)}
              />
              <Checkbox
                label="Medico-Legal Case"
                checked={isMedicoLegal}
                onChange={(e) => setIsMedicoLegal(e.currentTarget.checked)}
              />
            </Group>
            <TextInput
              label="Witness Name"
              value={witnessName}
              onChange={(e) => setWitnessName(e.currentTarget.value)}
            />
            <Textarea
              label="Notes"
              value={dsNotes}
              onChange={(e) => setDsNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    patient_id: patientId,
                    date_of_death: dateOfDeath,
                    time_of_death: timeOfDeath,
                    cause_of_death_primary: causePrimary || undefined,
                    cause_of_death_secondary: causeSecondary || undefined,
                    cause_of_death_underlying: causeUnderlying || undefined,
                    manner_of_death: mannerOfDeath || undefined,
                    form_type: (formType as DeathCertFormType) || undefined,
                    autopsy_requested: autopsyRequested,
                    is_medico_legal: isMedicoLegal,
                    witness_name: witnessName || undefined,
                    notes: dsNotes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!dateOfDeath || !timeOfDeath}
              >
                Save Death Summary
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Birth Records Tab
// ══════════════════════════════════════════════════════════
