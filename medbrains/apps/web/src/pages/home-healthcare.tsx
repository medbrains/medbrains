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
import { DateInput, DateTimePicker } from "@mantine/dates";
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
import { BillingPanel } from "./home-healthcare/billing-panel";
import { CaregiverEducationPanel } from "./home-healthcare/caregiver-education-panel";
import { DischargePanel } from "./home-healthcare/discharge-panel";
import { EscalationsPanel } from "./home-healthcare/escalations-panel";
import { HospicePanel } from "./home-healthcare/hospice-panel";
import { ProgressNotesPanel } from "./home-healthcare/progress-notes-panel";
import { RemoteVitalsPanel } from "./home-healthcare/remote-vitals-panel";

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

const BEREAVEMENT_TYPES = ["call", "visit", "support_group", "letter", "other"];

function BereavementPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [contact, setContact] = useState("");
  const [rel, setRel] = useState("");
  const [type, setType] = useState<string | null>("call");
  const [date, setDate] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["bereavement", patientId],
    queryFn: () => homeHealthService.listBereavement(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["bereavement", patientId] });
  };
  const schedule = useMutation({
    mutationFn: () =>
      homeHealthService.scheduleBereavement({
        patient_id: patientId,
        family_contact_name: contact,
        relationship: rel || undefined,
        contact_type: type ?? "call",
        scheduled_date: date ?? "",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Follow-up scheduled", { title: "Home healthcare" });
      setContact("");
      setRel("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateBereavement(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const berTone = (s: string): BadgeTone =>
    s === "completed" ? "success" : s === "declined" ? "neutral" : "info";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Bereavement support
      </Text>
      {canManage && (
        <>
          <Group grow>
            <TextInput
              label="Family contact"
              value={contact}
              onChange={(e) => setContact(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <Select
              label="Contact type"
              data={BEREAVEMENT_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <DateInput label="Scheduled date" value={date} onChange={setDate} />
          </Group>
          <Button
            onClick={() => schedule.mutate()}
            loading={schedule.isPending}
            disabled={!contact.trim() || !date}
          >
            Schedule follow-up
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No bereavement follow-ups.
        </Text>
      ) : (
        data.map((b) => (
          <Group key={b.id} justify="space-between">
            <Group gap={6}>
              <Badge tone={berTone(b.status)} size="xs">
                {b.contact_type.replace("_", " ")}
              </Badge>
              <Text size="sm">
                {b.family_contact_name}
                {b.relationship ? ` (${b.relationship})` : ""}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(b.scheduled_date).toLocaleDateString()}
              </Text>
            </Group>
            {canManage && b.status === "scheduled" && (
              <Group gap="xs">
                <Button
                  size="xs"
                  tone="primary"
                  onClick={() => update.mutate({ id: b.id, status: "completed" })}
                >
                  Done
                </Button>
                <Button
                  size="xs"
                  tone="ghost"
                  onClick={() => update.mutate({ id: b.id, status: "declined" })}
                >
                  Declined
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

const DIRECTIVE_TYPES = ["living_will", "dnr", "dpoa", "molst", "organ_donation"];

function AdvanceDirectivesPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("dnr");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [family, setFamily] = useState("");
  const [rel, setRel] = useState("");
  const [witnessed, setWitnessed] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["advance-directives", patientId],
    queryFn: () => homeHealthService.listAdvanceDirectives(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["advance-directives", patientId] });
  };
  const create = useMutation({
    mutationFn: () =>
      homeHealthService.createAdvanceDirective({
        patient_id: patientId,
        directive_type: type ?? "dnr",
        content: content || undefined,
        family_consent_obtained: consent,
        family_member_name: family || undefined,
        family_relationship: rel || undefined,
        witnessed_by: witnessed || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Directive recorded", { title: "Home healthcare" });
      setContent("");
      setConsent(false);
      setFamily("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const revoke = useMutation({
    mutationFn: () => homeHealthService.revokeAdvanceDirective(revokeId ?? "", { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Directive revoked", { title: "Home healthcare" });
      setRevokeId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Advance directives
      </Text>
      {canManage && (
        <>
          <Group grow>
            <Select
              label="Type"
              data={DIRECTIVE_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <TextInput
              label="Witnessed by"
              value={witnessed}
              onChange={(e) => setWitnessed(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Content"
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            placeholder="No CPR / no intubation"
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Family member"
              value={family}
              onChange={(e) => setFamily(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
            />
          </Group>
          <Switch
            label="Family consent obtained"
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
          />
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Record directive
          </Button>
        </>
      )}
      {revokeId && (
        <Group align="flex-end" gap="xs">
          <TextInput
            label="Revoke reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            tone="danger"
            onClick={() => revoke.mutate()}
            loading={revoke.isPending}
            disabled={!reason.trim()}
          >
            Confirm
          </Button>
          <Button tone="ghost" onClick={() => setRevokeId(null)}>
            Cancel
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No advance directives.
        </Text>
      ) : (
        data.map((d) => (
          <Group key={d.id} justify="space-between">
            <Group gap={6}>
              <Badge tone={d.status === "active" ? "success" : "neutral"} size="xs">
                {d.directive_type.replace("_", " ")}
              </Badge>
              {d.family_consent_obtained && (
                <Badge tone="info" size="xs">
                  family consent
                </Badge>
              )}
              <Text size="sm">{d.content}</Text>
            </Group>
            {canManage && d.status === "active" && (
              <Button size="xs" tone="danger" onClick={() => setRevokeId(d.id)}>
                Revoke
              </Button>
            )}
          </Group>
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
          <RemoteVitalsPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <BillingPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <CaregiverEducationPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <HospicePanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <AdvanceDirectivesPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <BereavementPanel patientId={patientId} canManage={canRecord} />
        </Card>
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
        <Card withBorder padding="md">
          <DischargePanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}

      {patientId && (
        <ScheduleModal patientId={patientId} opened={scheduleOpen} onClose={schedule.close} />
      )}
      <RecordModal med={recordMed} onClose={() => setRecordMed(null)} />
    </Stack>
  );
}
