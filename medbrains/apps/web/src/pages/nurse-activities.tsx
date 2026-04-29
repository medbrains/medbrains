import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

interface MarRow {
  id: string;
  prescription_id: string;
  patient_id: string;
  scheduled_at: string;
  status: string;
  dose_administered?: string | null;
  route?: string | null;
  late_minutes?: number | null;
}

interface IoEntryRow {
  id: string;
  encounter_id: string;
  recorded_at: string;
  category: string;
  direction: string;
  volume_ml: number;
  notes?: string | null;
}

interface CodeBlueRow {
  id: string;
  patient_id: string;
  location: string;
  started_at: string;
  ended_at?: string | null;
  outcome?: string | null;
}

const statusBadge: Record<string, string> = {
  pending: "yellow",
  administered: "green",
  held: "blue",
  refused: "orange",
  missed: "red",
};

export function NurseActivitiesPage() {
  useRequirePermission(P.NURSE.DASHBOARD_VIEW);
  const [tab, setTab] = useState<string>("mar");

  return (
    <div>
      <PageHeader title="Nurse Activities" subtitle="MAR, vitals, I/O, code blue and shift handoffs" />
      <Tabs value={tab} onChange={(v) => v && setTab(v)} variant="outline">
        <Tabs.List>
          <Tabs.Tab value="mar">MAR</Tabs.Tab>
          <Tabs.Tab value="io">Intake/Output</Tabs.Tab>
          <Tabs.Tab value="code-blue">Code Blue</Tabs.Tab>
          <Tabs.Tab value="other">Other</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="mar" pt="md">
          <MarTab />
        </Tabs.Panel>
        <Tabs.Panel value="io" pt="md">
          <IoTab />
        </Tabs.Panel>
        <Tabs.Panel value="code-blue" pt="md">
          <CodeBlueTab />
        </Tabs.Panel>
        <Tabs.Panel value="other" pt="md">
          <OtherTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── MAR Tab ─────────────────────────────────────────────────────────

function MarTab() {
  const qc = useQueryClient();
  const [windowMin, setWindowMin] = useState<number>(60);
  const [actioning, setActioning] = useState<{ id: string; mode: "administer" | "hold" | "refuse" } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mar-due-now", windowMin],
    queryFn: () => api.listMarDueNow({ window_min: windowMin }) as Promise<MarRow[]>,
  });

  const administer = useMutation({
    mutationFn: (id: string) =>
      api.administerMar(id, { wristband_scanned: true, drug_scanned: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mar-due-now"] }),
  });
  const hold = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => api.holdMar(vars.id, { reason: vars.reason }),
    onSuccess: () => {
      setActioning(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["mar-due-now"] });
    },
  });
  const refuse = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => api.refuseMar(vars.id, { reason: vars.reason }),
    onSuccess: () => {
      setActioning(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["mar-due-now"] });
    },
  });

  const submitReason = () => {
    if (!actioning) return;
    if (actioning.mode === "hold") hold.mutate({ id: actioning.id, reason });
    if (actioning.mode === "refuse") refuse.mutate({ id: actioning.id, reason });
  };

  return (
    <Stack>
      <Group>
        <NumberInput
          label="Look-ahead (minutes)"
          value={windowMin}
          onChange={(v) => setWindowMin(typeof v === "number" ? v : 60)}
          min={15}
          max={1440}
          step={15}
          w={200}
        />
      </Group>

      {isLoading && <Text c="dimmed">Loading…</Text>}
      {data?.length === 0 && <Text c="dimmed">No medications due in window.</Text>}

      <Stack gap="xs">
        {data?.map((row) => (
          <Card key={row.id} withBorder padding="md">
            <Group justify="space-between">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={600}>Rx {row.prescription_id.slice(0, 8)}</Text>
                  <Badge color={statusBadge[row.status] ?? "gray"}>{row.status}</Badge>
                  {row.late_minutes != null && row.late_minutes > 0 && (
                    <Badge color="red" variant="light">
                      {row.late_minutes}m late
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  Scheduled {new Date(row.scheduled_at).toLocaleString()}
                </Text>
              </Stack>
              {row.status === "pending" && (
                <Group>
                  <Button
                    size="xs"
                    color="green"
                    onClick={() => administer.mutate(row.id)}
                    loading={administer.isPending}
                  >
                    Administer
                  </Button>
                  <Button
                    size="xs"
                    color="blue"
                    variant="light"
                    onClick={() => setActioning({ id: row.id, mode: "hold" })}
                  >
                    Hold
                  </Button>
                  <Button
                    size="xs"
                    color="orange"
                    variant="light"
                    onClick={() => setActioning({ id: row.id, mode: "refuse" })}
                  >
                    Refuse
                  </Button>
                </Group>
              )}
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal
        opened={actioning !== null}
        onClose={() => {
          setActioning(null);
          setReason("");
        }}
        title={actioning?.mode === "hold" ? "Hold reason" : "Refusal reason"}
      >
        <Stack>
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={3}
            required
          />
          <Group justify="flex-end">
            <Button
              onClick={submitReason}
              disabled={!reason.trim()}
              loading={hold.isPending || refuse.isPending}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── I/O Tab ─────────────────────────────────────────────────────────

function IoTab() {
  const [encounterId, setEncounterId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["io-entries", encounterId],
    queryFn: () => api.listIoForEncounter(encounterId) as Promise<IoEntryRow[]>,
    enabled: encounterId.length > 0,
  });
  const { data: balance } = useQuery({
    queryKey: ["io-balance", encounterId],
    queryFn: () => api.getEncounterIoBalance(encounterId, 24) as Promise<{ intake_total: number; output_total: number; balance: number }>,
    enabled: encounterId.length > 0,
  });

  return (
    <Stack>
      <Group>
        <TextInput
          label="Encounter ID"
          value={encounterId}
          onChange={(e) => setEncounterId(e.currentTarget.value)}
          w={400}
          placeholder="UUID"
        />
        <Button mt={24} onClick={() => setCreateOpen(true)} disabled={!encounterId}>
          Add entry
        </Button>
      </Group>

      {balance && (
        <Group>
          <Card withBorder padding="md">
            <Text size="xs" c="dimmed">Intake (24h)</Text>
            <Title order={3}>{balance.intake_total} ml</Title>
          </Card>
          <Card withBorder padding="md">
            <Text size="xs" c="dimmed">Output (24h)</Text>
            <Title order={3}>{balance.output_total} ml</Title>
          </Card>
          <Card withBorder padding="md">
            <Text size="xs" c="dimmed">Balance</Text>
            <Title order={3} c={balance.balance < 0 ? "red" : "green"}>
              {balance.balance > 0 ? "+" : ""}
              {balance.balance} ml
            </Title>
          </Card>
        </Group>
      )}

      <Stack gap="xs">
        {data?.map((row) => (
          <Card key={row.id} withBorder padding="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge color={row.direction === "intake" ? "blue" : "orange"}>{row.direction}</Badge>
                <Text fw={500}>{row.category}</Text>
                <Text>{row.volume_ml} ml</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {new Date(row.recorded_at).toLocaleString()}
              </Text>
            </Group>
          </Card>
        ))}
      </Stack>

      <CreateIoModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        encounterId={encounterId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["io-entries"] });
          qc.invalidateQueries({ queryKey: ["io-balance"] });
        }}
      />
    </Stack>
  );
}

function CreateIoModal({
  opened,
  onClose,
  encounterId,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  encounterId: string;
  onCreated: () => void;
}) {
  const [direction, setDirection] = useState("intake");
  const [category, setCategory] = useState("oral");
  const [volume, setVolume] = useState<number>(100);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createIoEntry({
        encounter_id: encounterId,
        direction,
        category,
        volume_ml: volume,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      onCreated();
      onClose();
      setNotes("");
    },
  });

  const intakeCats = ["oral", "iv", "tube", "blood", "tpn", "other"];
  const outputCats = ["urine", "stool", "emesis", "drain", "other"];

  return (
    <Modal opened={opened} onClose={onClose} title="Add I/O entry">
      <Stack>
        <Select
          label="Direction"
          data={[
            { value: "intake", label: "Intake" },
            { value: "output", label: "Output" },
          ]}
          value={direction}
          onChange={(v) => v && setDirection(v)}
        />
        <Select
          label="Category"
          data={direction === "intake" ? intakeCats : outputCats}
          value={category}
          onChange={(v) => v && setCategory(v)}
        />
        <NumberInput label="Volume (ml)" value={volume} onChange={(v) => setVolume(typeof v === "number" ? v : 0)} min={1} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={2} />
        <Group justify="flex-end">
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={volume <= 0}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Code Blue Tab ───────────────────────────────────────────────────

function CodeBlueTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["code-blue", "active"],
    queryFn: () => api.listCodeBlue({ active_only: true }) as Promise<CodeBlueRow[]>,
    refetchInterval: 5000,
  });

  const end = useMutation({
    mutationFn: (id: string) => api.endCodeBlue(id, { outcome: "stable" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code-blue"] }),
  });

  return (
    <Stack>
      {data?.length === 0 && <Text c="dimmed">No active code blue events.</Text>}
      {data?.map((row) => (
        <Card key={row.id} withBorder padding="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Group gap="xs">
                <Badge color="red">ACTIVE</Badge>
                <Text fw={600}>{row.location}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Started {new Date(row.started_at).toLocaleTimeString()}
              </Text>
            </Stack>
            <Button color="red" onClick={() => end.mutate(row.id)} loading={end.isPending}>
              End event
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

// ── Other tabs (stub list of categories) ────────────────────────────

function OtherTab() {
  return (
    <Stack>
      <Text c="dimmed">
        Vitals schedules, pain entries, fall risk assessments, restraint monitoring, wound assessments,
        SBAR handoffs, and equipment checks are available via the API. Dedicated UIs land in a follow-up.
      </Text>
    </Stack>
  );
}
