import {
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { HomeMedAdministration } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconHome2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { homeHealthService } from "@/services/homeHealth.service";

function statusTone(s: string): BadgeTone {
  if (s === "administered") return "success";
  if (s === "missed") return "danger";
  if (s === "held") return "warning";
  return "neutral";
}

function ScheduleModal({
  patientId,
  opened,
  onClose,
}: {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [drug, setDrug] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("IV");
  const [isInfusion, setIsInfusion] = useState(true);
  const [rate, setRate] = useState("");
  const [when, setWhen] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      homeHealthService.scheduleHomeMed({
        patient_id: patientId,
        drug_name: drug,
        dose,
        route: route || undefined,
        is_infusion: isInfusion,
        infusion_rate: rate || undefined,
        scheduled_at: when ? new Date(when).toISOString() : new Date().toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-meds", patientId] });
      toast.success("Dose scheduled", { title: "Home healthcare" });
      onClose();
      setDrug("");
      setDose("");
      setRate("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Schedule failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Schedule home dose">
      <Stack gap="sm">
        <TextInput
          label="Drug"
          value={drug}
          onChange={(e) => setDrug(e.currentTarget.value)}
          placeholder="Ceftriaxone"
          required
        />
        <Group grow>
          <TextInput
            label="Dose"
            value={dose}
            onChange={(e) => setDose(e.currentTarget.value)}
            placeholder="2 g"
            required
          />
          <TextInput
            label="Route"
            value={route}
            onChange={(e) => setRoute(e.currentTarget.value)}
          />
        </Group>
        <Switch
          label="Infusion"
          checked={isInfusion}
          onChange={(e) => setIsInfusion(e.currentTarget.checked)}
        />
        {isInfusion && (
          <TextInput
            label="Infusion rate"
            value={rate}
            onChange={(e) => setRate(e.currentTarget.value)}
            placeholder="100 ml/hr"
          />
        )}
        <DateTimePicker label="Scheduled at" value={when} onChange={setWhen} />
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!drug.trim() || !dose.trim()}
        >
          Schedule
        </Button>
      </Stack>
    </Modal>
  );
}

function RecordModal({ med, onClose }: { med: HomeMedAdministration | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>("administered");
  const [site, setSite] = useState("");
  const [notes, setNotes] = useState("");

  const record = useMutation({
    mutationFn: () =>
      homeHealthService.recordHomeMed(med?.id ?? "", {
        status: status ?? "administered",
        administration_site: site || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      if (med) void qc.invalidateQueries({ queryKey: ["home-meds", med.patient_id] });
      toast.success("Recorded", { title: "Home healthcare" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Record failed" }),
  });

  return (
    <Modal opened={!!med} onClose={onClose} title={`Record — ${med?.drug_name ?? ""}`}>
      <Stack gap="sm">
        <Select
          label="Outcome"
          data={["administered", "missed", "held"].map((v) => ({ value: v, label: v }))}
          value={status}
          onChange={setStatus}
        />
        <TextInput
          label="Site"
          value={site}
          onChange={(e) => setSite(e.currentTarget.value)}
          placeholder="Left forearm PICC"
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button onClick={() => record.mutate()} loading={record.isPending}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

function EscalationsPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [raiseOpen, raise] = useDisclosure(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<string | null>("high");

  const { data = [] } = useQuery({
    queryKey: ["home-escalations", patientId],
    queryFn: () => homeHealthService.listEscalations(patientId),
    refetchInterval: 30_000,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-escalations", patientId] });
  };
  const raiseM = useMutation({
    mutationFn: () =>
      homeHealthService.raiseEscalation({
        patient_id: patientId,
        reason,
        severity: severity ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Escalation raised", { title: "Home healthcare" });
      raise.close();
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const updateM = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateEscalation(v.id, { status: v.status }),
    onSuccess: () => {
      invalidate();
      toast.success("Escalation updated", { title: "Home healthcare" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const sevTone = (s: string): BadgeTone =>
    s === "critical" ? "danger" : s === "high" ? "warning" : "neutral";
  const statTone = (s: string): BadgeTone => {
    if (s === "resolved") return "success";
    if (s === "ambulance_requested") return "warning";
    if (s === "cancelled") return "neutral";
    return "danger";
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Emergency escalations
        </Text>
        {canManage && (
          <Button size="xs" tone="danger" onClick={raise.open}>
            Raise escalation
          </Button>
        )}
      </Group>
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No escalations.
        </Text>
      ) : (
        data.map((e) => (
          <Group key={e.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={sevTone(e.severity)} size="xs">
                  {e.severity}
                </Badge>
                <Badge tone={statTone(e.status)} size="xs">
                  {e.status}
                </Badge>
                <Text size="sm">{e.reason}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date(e.created_at).toLocaleString()}
              </Text>
            </Stack>
            {canManage && (e.status === "raised" || e.status === "ambulance_requested") && (
              <Group gap="xs">
                {e.status === "raised" && (
                  <Button
                    size="xs"
                    tone="danger"
                    onClick={() => updateM.mutate({ id: e.id, status: "ambulance_requested" })}
                  >
                    Request ambulance
                  </Button>
                )}
                <Button
                  size="xs"
                  tone="secondary"
                  onClick={() => updateM.mutate({ id: e.id, status: "resolved" })}
                >
                  Resolve
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
      <Modal opened={raiseOpen} onClose={raise.close} title="Raise emergency escalation">
        <Stack gap="sm">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder="SpO2 87% (< 92 threshold)"
            minRows={2}
          />
          <Select
            label="Severity"
            data={["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v }))}
            value={severity}
            onChange={setSeverity}
          />
          <Button
            tone="danger"
            onClick={() => raiseM.mutate()}
            loading={raiseM.isPending}
            disabled={!reason.trim()}
          >
            Raise
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function ProgressNotesPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [role, setRole] = useState<string | null>("nurse");
  const { data = [] } = useQuery({
    queryKey: ["home-progress-notes", patientId],
    queryFn: () => homeHealthService.listProgressNotes(patientId),
  });
  const add = useMutation({
    mutationFn: () =>
      homeHealthService.addProgressNote({
        patient_id: patientId,
        author_role: role ?? "nurse",
        note_text: text,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-progress-notes", patientId] });
      toast.success("Note added", { title: "Home healthcare" });
      setText("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Progress notes
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Author"
            data={["nurse", "physician"].map((v) => ({ value: v, label: v }))}
            value={role}
            onChange={setRole}
            w={140}
          />
          <Textarea
            label="Note"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            style={{ flex: 1 }}
            minRows={1}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!text.trim()}>
            Add
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No progress notes.
        </Text>
      ) : (
        data.map((n) => (
          <Stack key={n.id} gap={0}>
            <Group gap={6}>
              <Badge tone="neutral" size="xs">
                {n.author_role}
              </Badge>
              <Text size="xs" c="dimmed">
                {new Date(n.note_date).toLocaleDateString()}
              </Text>
            </Group>
            <Text size="sm">{n.note_text}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}

export function HomeHealthcarePage() {
  useRequirePermission(P.IPD.MAR_LIST);
  const canRecord = useHasPermission(P.IPD.MAR_CREATE);
  const [patientId, setPatientId] = useState("");
  const [scheduleOpen, schedule] = useDisclosure(false);
  const [recordMed, setRecordMed] = useState<HomeMedAdministration | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["home-meds", patientId],
    queryFn: () => homeHealthService.listHomeMeds(patientId),
    enabled: !!patientId,
  });

  const columns: Column<HomeMedAdministration>[] = [
    {
      key: "drug",
      label: "Medication",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {r.drug_name} · {r.dose}
          </Text>
          <Text size="xs" c="dimmed">
            {r.route}
            {r.is_infusion ? ` · infusion ${r.infusion_rate ?? ""}` : ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (r) => new Date(r.scheduled_at).toLocaleString(),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "administered_at",
      label: "Given",
      render: (r) => (r.administered_at ? new Date(r.administered_at).toLocaleString() : "—"),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canRecord && r.status === "scheduled" ? (
          <Button size="xs" tone="secondary" onClick={() => setRecordMed(r)}>
            Record
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Home healthcare"
        subtitle="Home medication administration — IV antibiotics & infusions"
        icon={<IconHome2 size={20} />}
      />
      <Group align="flex-end" gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        {patientId && canRecord && (
          <Button leftSection={<IconPlus size={16} />} onClick={schedule.open}>
            Schedule dose
          </Button>
        )}
      </Group>

      {patientId ? (
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No home medications scheduled for this patient."
        />
      ) : (
        <Text c="dimmed">Select a patient to view their home medication schedule.</Text>
      )}

      {patientId && (
        <Card withBorder padding="md">
          <EscalationsPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <ProgressNotesPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}

      {patientId && (
        <ScheduleModal patientId={patientId} opened={scheduleOpen} onClose={schedule.close} />
      )}
      <RecordModal med={recordMed} onClose={() => setRecordMed(null)} />
    </Stack>
  );
}
