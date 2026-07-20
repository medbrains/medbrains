// IPD IoTab — split from nurse-activities.tsx (pure move).

import {
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconDeviceHeartMonitor, IconDroplet, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import {
  type ClinicalStatus,
  EncounterContextField,
  encounterLocked,
  formatDateTime,
  NEUTRAL_STATUS,
  statusBadgeTone,
  toNumber,
} from "./shared";

interface IoEntryRow {
  id: string;
  encounter_id: string;
  recorded_at: string;
  category: string;
  direction: string;
  volume_ml: number;
  notes?: string | null;
}

function ioBalanceStatus(balance: number | undefined): ClinicalStatus {
  if (balance === undefined) return NEUTRAL_STATUS;
  const absolute = Math.abs(balance);
  if (absolute <= 250) {
    return { label: "Balanced", color: "green", tone: "good" };
  }
  if (absolute <= 1000) {
    return {
      label: balance > 0 ? "Positive balance" : "Negative balance",
      color: "orange",
      tone: balance > 0 ? "high" : "low",
    };
  }
  return {
    label: balance > 0 ? "High positive" : "High negative",
    color: "red",
    tone: "critical",
  };
}

function formatMl(value: number | undefined): string {
  return `${value ?? 0} ml`;
}

function ClinicalIndicatorCard({
  detail,
  icon,
  label,
  status,
  value,
}: {
  detail?: ReactNode;
  icon: ReactNode;
  label: string;
  status: ClinicalStatus;
  value: ReactNode;
}) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <ThemeIcon color={status.color} variant="light" radius="md">
            {icon}
          </ThemeIcon>
          <Stack gap={1}>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            <Text size="sm" fw={700}>
              {value}
            </Text>
          </Stack>
        </Group>
        <Badge tone={statusBadgeTone(status.color)} size="sm">
          {status.label}
        </Badge>
      </Group>
      {detail && (
        <Text size="xs" c="dimmed" mt={6}>
          {detail}
        </Text>
      )}
    </Card>
  );
}

function CreateIoPanel({ encounterId, onCreated }: { encounterId: string; onCreated: () => void }) {
  const [direction, setDirection] = useState<"intake" | "output">("intake");
  const [category, setCategory] = useState("oral");
  const [volume, setVolume] = useState<number>(100);
  const [notes, setNotes] = useState("");
  const intakeCats = ["oral", "iv", "tube", "blood", "tpn", "other"];
  const outputCats = ["urine", "stool", "emesis", "drain", "other"];
  const directionStatus: ClinicalStatus =
    direction === "intake"
      ? { label: "Intake", color: "blue", tone: "neutral" }
      : { label: "Output", color: "orange", tone: "neutral" };

  const create = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createIoEntry({
        encounter_id: encounterId,
        direction,
        category,
        volume_ml: volume,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      onCreated();
      setVolume(100);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save I/O entry" }),
  });

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={700}>Quick I/O Entry</Text>
            <Text size="xs" c="dimmed">
              Record every fluid input/output against the linked encounter.
            </Text>
          </Stack>
          <Badge tone={statusBadgeTone(directionStatus.color)}>{directionStatus.label}</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm">
          <SegmentedControl
            value={direction}
            onChange={(value) => {
              const next = value === "output" ? "output" : "intake";
              setDirection(next);
              setCategory(next === "intake" ? "oral" : "urine");
            }}
            data={[
              { value: "intake", label: "Intake" },
              { value: "output", label: "Output" },
            ]}
          />
          <Select
            label="Category"
            data={direction === "intake" ? intakeCats : outputCats}
            value={category}
            onChange={(value) => value && setCategory(value)}
          />
          <NumberInput
            label="Volume"
            value={volume}
            onChange={(value) => setVolume(toNumber(value))}
            min={1}
            suffix=" ml"
          />
          <Button
            tone="primary"
            mt={{ base: 0, md: 24 }}
            leftSection={<IconPlus size={14} />}
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!encounterId || volume <= 0}
          >
            Save entry
          </Button>
        </SimpleGrid>
        <Textarea
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          autosize
          minRows={2}
        />
      </Stack>
    </Card>
  );
}

export function IoTab({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const canView = useHasPermission(P.NURSE.INTAKE_OUTPUT_VIEW);
  const canRecord = useHasPermission(P.NURSE.INTAKE_OUTPUT_RECORD);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["io-entries", encounterId],
    queryFn: () => nurseActivitiesService.listIoForEncounter(encounterId) as Promise<IoEntryRow[]>,
    enabled: canView && encounterId.length > 0,
  });
  const { data: balance } = useQuery({
    queryKey: ["io-balance", encounterId],
    queryFn: () =>
      nurseActivitiesService.getEncounterIoBalance(encounterId, 24) as Promise<{
        intake_total: number;
        output_total: number;
        balance: number;
      }>,
    enabled: canView && encounterId.length > 0,
  });

  return (
    <Stack>
      <Group align="end">
        <EncounterContextField
          value={encounterId}
          onChange={setEncounterId}
          locked={isLinkedEncounter}
          patientId={patientId}
        />
        {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
        {!canRecord && (
          <Text size="xs" c="dimmed" mt={28}>
            View only
          </Text>
        )}
      </Group>

      {balance && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <ClinicalIndicatorCard
            icon={<IconDroplet size={18} />}
            label="Intake (24h)"
            value={formatMl(balance.intake_total)}
            status={{ label: "In", color: "blue", tone: "neutral" }}
          />
          <ClinicalIndicatorCard
            icon={<IconDroplet size={18} />}
            label="Output (24h)"
            value={formatMl(balance.output_total)}
            status={{ label: "Out", color: "orange", tone: "neutral" }}
          />
          <ClinicalIndicatorCard
            icon={<IconDeviceHeartMonitor size={18} />}
            label="Net balance"
            value={`${balance.balance > 0 ? "+" : ""}${formatMl(balance.balance)}`}
            status={ioBalanceStatus(balance.balance)}
            detail="Green is within +/-250 ml; orange/red needs nurse review per ward protocol."
          />
        </SimpleGrid>
      )}

      {canRecord && (
        <CreateIoPanel
          encounterId={encounterId}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["io-entries"] });
            qc.invalidateQueries({ queryKey: ["io-balance"] });
          }}
        />
      )}

      {canView ? (
        <Stack gap="xs">
          {data?.map((row) => (
            <Card key={row.id} withBorder padding="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge tone={row.direction === "intake" ? "info" : "warning"}>
                    {row.direction}
                  </Badge>
                  <Text fw={500}>{row.category}</Text>
                  <Text>{row.volume_ml} ml</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {formatDateTime(row.recorded_at)}
                </Text>
              </Group>
              {row.notes && (
                <Text size="xs" c="dimmed" mt={4}>
                  {row.notes}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          You can record intake/output, but history and balance require I/O view permission.
        </Text>
      )}
    </Stack>
  );
}
