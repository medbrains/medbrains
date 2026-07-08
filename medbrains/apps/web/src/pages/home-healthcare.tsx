import {
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
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

function DischargePanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string | null>("criterion");
  const { data = [] } = useQuery({
    queryKey: ["home-discharge", patientId],
    queryFn: () => homeHealthService.listDischargeProgram(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-discharge", patientId] });
  };
  const add = useMutation({
    mutationFn: () =>
      homeHealthService.addDischargeItem({
        patient_id: patientId,
        item_type: type ?? "criterion",
        title,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Item added", { title: "Home healthcare" });
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) =>
      homeHealthService.toggleDischargeItem(v.id, v.done),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Discharge readiness
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Type"
            data={[
              { value: "criterion", label: "Discharge criterion" },
              { value: "training", label: "Training material" },
            ]}
            value={type}
            onChange={setType}
            w={190}
          />
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!title.trim()}>
            Add
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No discharge items.
        </Text>
      ) : (
        data.map((i) => (
          <Group key={i.id} gap="xs">
            <Checkbox
              checked={i.is_complete}
              disabled={!canManage}
              onChange={(e) => toggle.mutate({ id: i.id, done: e.currentTarget.checked })}
              label={i.title}
            />
            <Badge tone="neutral" size="xs">
              {i.item_type === "training" ? "training" : "criterion"}
            </Badge>
          </Group>
        ))
      )}
    </Stack>
  );
}

const DEVICE_FIELDS: Record<string, { key: string; label: string }[]> = {
  pulse_ox: [
    { key: "spo2", label: "SpO₂ %" },
    { key: "pulse", label: "Pulse" },
  ],
  bp: [
    { key: "systolic", label: "Systolic" },
    { key: "diastolic", label: "Diastolic" },
  ],
  glucometer: [{ key: "glucose", label: "Glucose" }],
  thermometer: [{ key: "temp", label: "Temp °C" }],
  weight: [{ key: "weight", label: "Weight kg" }],
};

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

function HospicePanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [diag, setDiag] = useState("");
  const [prognosis, setPrognosis] = useState("");
  const [plan, setPlan] = useState("");
  const [dnr, setDnr] = useState(false);
  const [caregiver, setCaregiver] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["hospice", patientId],
    queryFn: () => homeHealthService.listHospiceEnrollments(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["hospice", patientId] });
  };
  const enroll = useMutation({
    mutationFn: () =>
      homeHealthService.enrollHospice({
        patient_id: patientId,
        terminal_diagnosis: diag || undefined,
        prognosis: prognosis || undefined,
        comfort_care_plan: plan || undefined,
        dnr_confirmed: dnr,
        primary_caregiver: caregiver || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Enrolled in hospice", { title: "Home healthcare" });
      setDiag("");
      setPrognosis("");
      setPlan("");
      setDnr(false);
      setCaregiver("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateHospice(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const hasActive = data.some((h) => h.status === "active");
  const hospiceTone = (s: string): BadgeTone =>
    s === "active" ? "success" : s === "deceased" ? "neutral" : "warning";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Hospice / palliative care
      </Text>
      {canManage && !hasActive && (
        <>
          <Group grow>
            <TextInput
              label="Terminal diagnosis"
              value={diag}
              onChange={(e) => setDiag(e.currentTarget.value)}
            />
            <TextInput
              label="Prognosis"
              value={prognosis}
              onChange={(e) => setPrognosis(e.currentTarget.value)}
              placeholder="< 6 months"
            />
          </Group>
          <Textarea
            label="Comfort care plan"
            value={plan}
            onChange={(e) => setPlan(e.currentTarget.value)}
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Primary caregiver"
              value={caregiver}
              onChange={(e) => setCaregiver(e.currentTarget.value)}
            />
            <Switch
              label="DNR confirmed"
              checked={dnr}
              onChange={(e) => setDnr(e.currentTarget.checked)}
              mt="lg"
            />
          </Group>
          <Button onClick={() => enroll.mutate()} loading={enroll.isPending}>
            Enroll in hospice
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          Not enrolled in hospice.
        </Text>
      ) : (
        data.map((h) => (
          <Group key={h.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={hospiceTone(h.status)} size="xs">
                  {h.status}
                </Badge>
                {h.dnr_confirmed && (
                  <Badge tone="danger" size="xs">
                    DNR
                  </Badge>
                )}
                <Text size="sm">
                  {h.terminal_diagnosis} · {h.prognosis}
                </Text>
              </Group>
              {h.comfort_care_plan && (
                <Text size="xs" c="dimmed">
                  {h.comfort_care_plan}
                </Text>
              )}
            </Stack>
            {canManage && h.status === "active" && (
              <Select
                size="xs"
                w={130}
                data={["active", "discharged", "deceased"].map((v) => ({ value: v, label: v }))}
                value={h.status}
                onChange={(v) => v && update.mutate({ id: h.id, status: v })}
                aria-label="Hospice status"
              />
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

function CaregiverEducationPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [topic, setTopic] = useState("");
  const [materials, setMaterials] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["caregiver-edu", patientId],
    queryFn: () => homeHealthService.listCaregiverEducation(patientId),
  });
  const record = useMutation({
    mutationFn: () =>
      homeHealthService.recordCaregiverEducation({
        patient_id: patientId,
        caregiver_name: name,
        relationship: rel || undefined,
        topic,
        materials_provided: materials || undefined,
        understanding_confirmed: confirmed,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["caregiver-edu", patientId] });
      toast.success("Session recorded", { title: "Home healthcare" });
      setName("");
      setTopic("");
      setMaterials("");
      setConfirmed(false);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Caregiver education
      </Text>
      {canManage && (
        <>
          <Group grow>
            <TextInput
              label="Caregiver"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
              placeholder="son / spouse"
            />
          </Group>
          <Group grow>
            <TextInput
              label="Topic"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              placeholder="Wound dressing technique"
            />
            <TextInput
              label="Materials given"
              value={materials}
              onChange={(e) => setMaterials(e.currentTarget.value)}
            />
          </Group>
          <Switch
            label="Understanding confirmed (teach-back)"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.currentTarget.checked)}
          />
          <Button
            onClick={() => record.mutate()}
            loading={record.isPending}
            disabled={!name.trim() || !topic.trim()}
          >
            Record session
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No caregiver education recorded.
        </Text>
      ) : (
        data.map((s) => (
          <Group key={s.id} gap="xs">
            <Text size="sm">
              {s.caregiver_name}
              {s.relationship ? ` (${s.relationship})` : ""} · {s.topic}
            </Text>
            <Badge tone={s.understanding_confirmed ? "success" : "warning"} size="xs">
              {s.understanding_confirmed ? "understood" : "pending"}
            </Badge>
            <Text size="xs" c="dimmed">
              {new Date(s.session_date).toLocaleDateString()}
            </Text>
          </Group>
        ))
      )}
    </Stack>
  );
}

function BillingPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [visits, setVisits] = useState<number | "">(10);
  const [price, setPrice] = useState<number | "">("");

  const { data = [] } = useQuery({
    queryKey: ["home-packages", patientId],
    queryFn: () => homeHealthService.listHomeCarePackages(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-packages", patientId] });
  };
  const buy = useMutation({
    mutationFn: () =>
      homeHealthService.createHomeCarePackage({
        patient_id: patientId,
        name,
        total_visits: typeof visits === "number" ? visits : 0,
        price: typeof price === "number" ? price : 0,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Package sold & charged", { title: "Home healthcare" });
      setName("");
      setPrice("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const consume = useMutation({
    mutationFn: (id: string) => homeHealthService.consumePackageVisit(id),
    onSuccess: () => {
      invalidate();
      toast.success("Visit deducted", { title: "Home healthcare" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Home care billing
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Package"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Post-op home care"
            style={{ flex: 1 }}
          />
          <NumberInput
            label="Visits"
            value={visits}
            onChange={(v) => setVisits(typeof v === "number" ? v : "")}
            min={1}
            w={90}
          />
          <NumberInput
            label="Price ₹"
            value={price}
            onChange={(v) => setPrice(typeof v === "number" ? v : "")}
            min={0}
            w={120}
          />
          <Button
            onClick={() => buy.mutate()}
            loading={buy.isPending}
            disabled={!name.trim() || !visits || !price}
          >
            Sell & charge
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No packages.
        </Text>
      ) : (
        data.map((pk) => (
          <Group key={pk.id} justify="space-between">
            <Group gap={6}>
              <Text size="sm">{pk.name}</Text>
              <Badge tone={pk.status === "active" ? "success" : "neutral"} size="xs">
                {pk.used_visits}/{pk.total_visits}
              </Badge>
              <Text size="xs" c="dimmed">
                ₹{pk.price}
              </Text>
            </Group>
            {canManage && pk.status === "active" && pk.used_visits < pk.total_visits && (
              <Button size="xs" tone="secondary" onClick={() => consume.mutate(pk.id)}>
                Use a visit
              </Button>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

function RemoteVitalsPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [device, setDevice] = useState("pulse_ox");
  const [values, setValues] = useState<Record<string, number | "">>({});
  const fields = DEVICE_FIELDS[device] ?? [];

  const { data = [] } = useQuery({
    queryKey: ["remote-vitals", patientId],
    queryFn: () => homeHealthService.listRemoteVitals(patientId),
    refetchInterval: 30_000,
  });
  const record = useMutation({
    mutationFn: () => {
      const reading: Record<string, number> = {};
      for (const f of fields) {
        const v = values[f.key];
        if (typeof v === "number") reading[f.key] = v;
      }
      return homeHealthService.ingestRemoteVital({
        patient_id: patientId,
        device_type: device,
        reading,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["remote-vitals", patientId] });
      toast.success("Reading recorded", { title: "Home healthcare" });
      setValues({});
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Remote monitoring
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Device"
            data={Object.keys(DEVICE_FIELDS).map((d) => ({ value: d, label: d.replace("_", " ") }))}
            value={device}
            onChange={(v) => {
              setDevice(v ?? "pulse_ox");
              setValues({});
            }}
            w={150}
          />
          {fields.map((f) => (
            <NumberInput
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(v) =>
                setValues((p) => ({ ...p, [f.key]: typeof v === "number" ? v : "" }))
              }
              w={110}
            />
          ))}
          <Button onClick={() => record.mutate()} loading={record.isPending}>
            Record
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No remote readings.
        </Text>
      ) : (
        data.map((r) => (
          <Group key={r.id} gap="xs">
            <Badge tone={r.is_flagged ? "danger" : "neutral"} size="xs">
              {r.device_type.replace("_", " ")}
            </Badge>
            <Text size="sm">
              {Object.entries(r.reading)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </Text>
            {r.is_flagged && (
              <Badge tone="danger" size="xs">
                abnormal
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              {new Date(r.measured_at).toLocaleString()}
            </Text>
          </Group>
        ))
      )}
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
