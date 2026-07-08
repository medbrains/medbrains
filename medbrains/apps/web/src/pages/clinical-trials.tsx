import { Group, Modal, NumberInput, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type { ClinicalTrial } from "@medbrains/types";
import { IconFlask2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

const STATUSES = ["planned", "recruiting", "active", "completed", "terminated", "suspended"];

function statusTone(s: string): BadgeTone {
  if (s === "active" || s === "recruiting") return "success";
  if (s === "terminated" || s === "suspended") return "danger";
  if (s === "completed") return "info";
  return "neutral";
}

function CreateTrialModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [protocol, setProtocol] = useState("");
  const [title, setTitle] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("planned");
  const [pi, setPi] = useState("");
  const [enroll, setEnroll] = useState<number | "">("");

  const create = useMutation({
    mutationFn: () =>
      clinicalTrialsService.createClinicalTrial({
        protocol_number: protocol,
        title,
        sponsor: sponsor || undefined,
        phase: phase ?? undefined,
        status: status ?? undefined,
        principal_investigator: pi || undefined,
        target_enrollment: typeof enroll === "number" ? enroll : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      toast.success("Trial registered", { title: "Clinical trials" });
      onClose();
      setProtocol("");
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Register failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Register clinical trial" size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Protocol number"
            value={protocol}
            onChange={(e) => setProtocol(e.currentTarget.value)}
            required
          />
          <Select
            label="Phase"
            data={["I", "II", "III", "IV"].map((v) => ({ value: v, label: `Phase ${v}` }))}
            value={phase}
            onChange={setPhase}
            clearable
          />
        </Group>
        <TextInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Group grow>
          <TextInput
            label="Sponsor"
            value={sponsor}
            onChange={(e) => setSponsor(e.currentTarget.value)}
          />
          <TextInput
            label="Principal investigator"
            value={pi}
            onChange={(e) => setPi(e.currentTarget.value)}
          />
        </Group>
        <Group grow>
          <Select
            label="Status"
            data={STATUSES.map((v) => ({ value: v, label: v }))}
            value={status}
            onChange={setStatus}
          />
          <NumberInput
            label="Target enrollment"
            value={enroll}
            onChange={(v) => setEnroll(typeof v === "number" ? v : "")}
            min={0}
          />
        </Group>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!protocol.trim() || !title.trim()}
        >
          Register
        </Button>
      </Stack>
    </Modal>
  );
}

function CandidatesModal({ trial, onClose }: { trial: ClinicalTrial | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [minAge, setMinAge] = useState<number | "">(trial?.min_age ?? "");
  const [maxAge, setMaxAge] = useState<number | "">(trial?.max_age ?? "");
  const [sex, setSex] = useState<string | null>(trial?.eligibility_sex ?? null);
  const [codes, setCodes] = useState((trial?.diagnosis_codes ?? []).join(", "));

  const save = useMutation({
    mutationFn: () =>
      clinicalTrialsService.updateClinicalTrial(trial?.id ?? "", {
        min_age: typeof minAge === "number" ? minAge : undefined,
        max_age: typeof maxAge === "number" ? maxAge : undefined,
        eligibility_sex: sex ?? undefined,
        diagnosis_codes: codes
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      void qc.invalidateQueries({ queryKey: ["trial-candidates", trial?.id] });
      toast.success("Eligibility saved — re-screened", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Save failed" }),
  });

  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["trial-candidates", trial?.id],
    queryFn: () => clinicalTrialsService.screenTrialCandidates(trial?.id ?? ""),
    enabled: !!trial,
  });

  return (
    <Modal
      opened={!!trial}
      onClose={onClose}
      title={`Candidates — ${trial?.protocol_number ?? ""}`}
      size="lg"
    >
      <Stack gap="sm">
        <Group grow>
          <NumberInput
            label="Min age"
            value={minAge}
            onChange={(v) => setMinAge(typeof v === "number" ? v : "")}
            min={0}
          />
          <NumberInput
            label="Max age"
            value={maxAge}
            onChange={(v) => setMaxAge(typeof v === "number" ? v : "")}
            min={0}
          />
          <Select
            label="Biological sex"
            data={["male", "female", "other"].map((v) => ({ value: v, label: v }))}
            value={sex}
            onChange={setSex}
            clearable
          />
        </Group>
        <TextInput
          label="Required diagnosis ICD codes (comma-separated)"
          value={codes}
          onChange={(e) => setCodes(e.currentTarget.value)}
          placeholder="I10, E11.9"
        />
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save eligibility & re-screen
        </Button>
        <Text fw={600} size="sm">
          Matched patients {isFetching ? "…" : `(${candidates.length})`}
        </Text>
        {candidates.length === 0 ? (
          <Text size="sm" c="dimmed">
            No patients match the current eligibility.
          </Text>
        ) : (
          candidates.map((c) => (
            <Group key={c.id} gap="xs">
              <Text size="sm">
                {c.first_name} {c.last_name}
              </Text>
              <Badge tone="neutral" size="xs">
                {c.age ?? "?"}y · {c.biological_sex ?? "?"}
              </Badge>
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

function ConsentsModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: consents = [] } = useQuery({
    queryKey: ["trial-consents", trial.id],
    queryFn: () => clinicalTrialsService.listTrialConsents(trial.id),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["consent-templates-active"],
    queryFn: () => clinicalTrialsService.listConsentTemplates({ is_active: true }),
  });
  const record = useMutation({
    mutationFn: () =>
      clinicalTrialsService.recordTrialConsent(trial.id, {
        patient_id: patientId,
        template_id: templateId ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trial-consents", trial.id] });
      toast.success("Consent recorded", { title: "Clinical trials" });
      setPatientId("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Record failed" }),
  });

  return (
    <Modal opened onClose={onClose} title={`Informed consent — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Select
          label="Consent form (versioned)"
          data={templates.map((t) => ({ value: t.id, label: `${t.name} · v${t.version}` }))}
          value={templateId}
          onChange={setTemplateId}
          clearable
          searchable
        />
        <Button onClick={() => record.mutate()} loading={record.isPending} disabled={!patientId}>
          Record signed consent
        </Button>
        <Text fw={600} size="sm">
          Recorded consents ({consents.length})
        </Text>
        {consents.length === 0 ? (
          <Text size="sm" c="dimmed">
            No consents recorded for this trial.
          </Text>
        ) : (
          consents.map((c) => (
            <Group key={c.id} gap="xs">
              <Text size="sm">
                {c.first_name} {c.last_name}
              </Text>
              <Badge tone={c.is_revoked ? "danger" : "success"} size="xs">
                {c.is_revoked ? "revoked" : "signed"}
              </Badge>
              {c.template_name && (
                <Badge tone="neutral" size="xs">
                  {c.template_name} v{c.template_version}
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {c.patient_signed_at ? new Date(c.patient_signed_at).toLocaleDateString() : ""}
              </Text>
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

function VisitsModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [visitName, setVisitName] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [procedures, setProcedures] = useState("");

  const { data: visits = [] } = useQuery({
    queryKey: ["trial-visits", trial.id],
    queryFn: () => clinicalTrialsService.listTrialVisits(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-visits", trial.id] });
  };
  const schedule = useMutation({
    mutationFn: () =>
      clinicalTrialsService.scheduleTrialVisit(trial.id, {
        patient_id: patientId,
        visit_name: visitName,
        scheduled_date: date ?? "",
        procedures: procedures || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Visit scheduled", { title: "Clinical trials" });
      setVisitName("");
      setProcedures("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Schedule failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateTrialVisit(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const visitTone = (s: string): BadgeTone => {
    if (s === "completed") return "success";
    if (s === "missed") return "danger";
    if (s === "rescheduled") return "warning";
    return "neutral";
  };

  return (
    <Modal opened onClose={onClose} title={`Visit schedule — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Visit name"
            value={visitName}
            onChange={(e) => setVisitName(e.currentTarget.value)}
            placeholder="Screening / Day 0 / Day 28"
          />
          <DateInput label="Scheduled date" value={date} onChange={setDate} />
        </Group>
        <TextInput
          label="Procedures"
          value={procedures}
          onChange={(e) => setProcedures(e.currentTarget.value)}
          placeholder="CBC, ECG, PK sampling"
        />
        <Button
          onClick={() => schedule.mutate()}
          loading={schedule.isPending}
          disabled={!patientId || !visitName.trim() || !date}
        >
          Schedule visit
        </Button>
        <Text fw={600} size="sm">
          Scheduled visits ({visits.length})
        </Text>
        {visits.length === 0 ? (
          <Text size="sm" c="dimmed">
            No visits scheduled.
          </Text>
        ) : (
          visits.map((v) => (
            <Group key={v.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  <Badge tone={visitTone(v.status)} size="xs">
                    {v.status}
                  </Badge>
                  <Text size="sm">
                    {v.visit_name} · {v.first_name} {v.last_name}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(v.scheduled_date).toLocaleDateString()}
                  {v.procedures ? ` · ${v.procedures}` : ""}
                </Text>
              </Stack>
              {v.status === "scheduled" && (
                <Group gap="xs">
                  <Button
                    size="xs"
                    tone="primary"
                    onClick={() => update.mutate({ id: v.id, status: "completed" })}
                  >
                    Complete
                  </Button>
                  <Button
                    size="xs"
                    tone="danger"
                    onClick={() => update.mutate({ id: v.id, status: "missed" })}
                  >
                    Missed
                  </Button>
                </Group>
              )}
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

const AE_OUTCOMES = ["recovered", "recovering", "ongoing", "fatal", "unknown"];
const AE_RELATEDNESS = ["unassessed", "unrelated", "possible", "probable", "definite"];

function AeModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [term, setTerm] = useState("");
  const [severity, setSeverity] = useState<string | null>("mild");
  const [serious, setSerious] = useState(false);
  const [relatedness, setRelatedness] = useState<string | null>("unassessed");
  const [outcome, setOutcome] = useState<string | null>("ongoing");
  const [desc, setDesc] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["trial-aes", trial.id],
    queryFn: () => clinicalTrialsService.listAdverseEvents(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-aes", trial.id] });
  };
  const report = useMutation({
    mutationFn: () =>
      clinicalTrialsService.reportAdverseEvent(trial.id, {
        patient_id: patientId,
        event_term: term,
        severity: severity ?? undefined,
        is_serious: serious,
        relatedness: relatedness ?? undefined,
        outcome: outcome ?? undefined,
        description: desc || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Adverse event reported", { title: "Clinical trials" });
      setTerm("");
      setDesc("");
      setSerious(false);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Report failed" }),
  });
  const setOutcomeM = useMutation({
    mutationFn: (v: { id: string; outcome: string }) =>
      clinicalTrialsService.updateAdverseEvent(v.id, { outcome: v.outcome }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const sevTone = (s: string): BadgeTone =>
    s === "severe" ? "danger" : s === "moderate" ? "warning" : "neutral";

  return (
    <Modal opened onClose={onClose} title={`Adverse events — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Event term"
            value={term}
            onChange={(e) => setTerm(e.currentTarget.value)}
            placeholder="Nausea"
          />
          <Select
            label="Severity"
            data={["mild", "moderate", "severe"].map((v) => ({ value: v, label: v }))}
            value={severity}
            onChange={setSeverity}
          />
        </Group>
        <Group grow>
          <Select
            label="Relatedness"
            data={AE_RELATEDNESS.map((v) => ({ value: v, label: v }))}
            value={relatedness}
            onChange={setRelatedness}
          />
          <Select
            label="Outcome"
            data={AE_OUTCOMES.map((v) => ({ value: v, label: v }))}
            value={outcome}
            onChange={setOutcome}
          />
        </Group>
        <TextInput
          label="Description"
          value={desc}
          onChange={(e) => setDesc(e.currentTarget.value)}
        />
        <Switch
          label="Serious (SAE)"
          checked={serious}
          onChange={(e) => setSerious(e.currentTarget.checked)}
        />
        <Button
          onClick={() => report.mutate()}
          loading={report.isPending}
          disabled={!patientId || !term.trim()}
        >
          Report event
        </Button>
        <Text fw={600} size="sm">
          Reported events ({events.length})
        </Text>
        {events.length === 0 ? (
          <Text size="sm" c="dimmed">
            No adverse events reported.
          </Text>
        ) : (
          events.map((ev) => (
            <Group key={ev.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  {ev.is_serious && (
                    <Badge tone="danger" size="xs">
                      SAE
                    </Badge>
                  )}
                  <Badge tone={sevTone(ev.severity)} size="xs">
                    {ev.severity}
                  </Badge>
                  <Text size="sm">
                    {ev.event_term} · {ev.first_name} {ev.last_name}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {ev.relatedness} · {new Date(ev.reported_date).toLocaleDateString()}
                </Text>
              </Stack>
              <Select
                size="xs"
                w={130}
                data={AE_OUTCOMES.map((v) => ({ value: v, label: v }))}
                value={ev.outcome}
                onChange={(v) => v && setOutcomeM.mutate({ id: ev.id, outcome: v })}
                aria-label="Outcome"
              />
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

function RandomizationModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [arm, setArm] = useState("");
  const [code, setCode] = useState("");
  const [unblindId, setUnblindId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["trial-randomizations", trial.id],
    queryFn: () => clinicalTrialsService.listRandomizations(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-randomizations", trial.id] });
  };
  const randomize = useMutation({
    mutationFn: () =>
      clinicalTrialsService.randomizePatient(trial.id, {
        patient_id: patientId,
        arm,
        randomization_code: code || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Patient randomized", { title: "Clinical trials" });
      setArm("");
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Randomize failed" }),
  });
  const unblind = useMutation({
    mutationFn: () => clinicalTrialsService.unblindRandomization(unblindId ?? "", { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Unblinded", { title: "Clinical trials" });
      setUnblindId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Unblind failed" }),
  });

  return (
    <Modal opened onClose={onClose} title={`Randomization — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Arm (from IWRS)"
            value={arm}
            onChange={(e) => setArm(e.currentTarget.value)}
            placeholder="Arm A / Arm B"
          />
          <TextInput
            label="Randomization code"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            placeholder="R-0007"
          />
        </Group>
        <Button
          onClick={() => randomize.mutate()}
          loading={randomize.isPending}
          disabled={!patientId || !arm.trim()}
        >
          Randomize patient
        </Button>

        {unblindId && (
          <Group align="flex-end" gap="xs">
            <TextInput
              label="Unblinding reason"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Medical emergency — SAE management"
              style={{ flex: 1 }}
            />
            <Button
              tone="danger"
              onClick={() => unblind.mutate()}
              loading={unblind.isPending}
              disabled={!reason.trim()}
            >
              Confirm unblind
            </Button>
            <Button tone="ghost" onClick={() => setUnblindId(null)}>
              Cancel
            </Button>
          </Group>
        )}

        <Text fw={600} size="sm">
          Randomized patients ({rows.length})
        </Text>
        {rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No patients randomized.
          </Text>
        ) : (
          rows.map((r) => (
            <Group key={r.id} justify="space-between">
              <Group gap={6}>
                <Text size="sm">
                  {r.first_name} {r.last_name}
                </Text>
                {r.randomization_code && (
                  <Badge tone="neutral" size="xs">
                    {r.randomization_code}
                  </Badge>
                )}
                {r.is_unblinded ? (
                  <Badge tone="warning" size="xs">
                    unblinded · {r.arm}
                  </Badge>
                ) : (
                  <Badge tone="info" size="xs">
                    blinded
                  </Badge>
                )}
              </Group>
              {!r.is_unblinded && (
                <Button size="xs" tone="danger" onClick={() => setUnblindId(r.id)}>
                  Unblind
                </Button>
              )}
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

const IRB_TYPES = ["initial", "amendment", "renewal", "sae_report", "closure"];
const IRB_STATUS = ["submitted", "under_review", "approved", "rejected", "deferred"];

function IrbModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("initial");
  const [committee, setCommittee] = useState("");
  const [ref, setRef] = useState("");

  const { data: subs = [] } = useQuery({
    queryKey: ["trial-irb", trial.id],
    queryFn: () => clinicalTrialsService.listIrbSubmissions(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-irb", trial.id] });
  };
  const create = useMutation({
    mutationFn: () =>
      clinicalTrialsService.createIrbSubmission(trial.id, {
        submission_type: type ?? "initial",
        committee_name: committee || undefined,
        reference_number: ref || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Submission recorded", { title: "Clinical trials" });
      setCommittee("");
      setRef("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateIrbSubmission(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const irbTone = (s: string): BadgeTone => {
    if (s === "approved") return "success";
    if (s === "rejected") return "danger";
    if (s === "deferred") return "warning";
    if (s === "under_review") return "info";
    return "neutral";
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Ethics submissions — ${trial.protocol_number}`}
      size="lg"
    >
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Type"
            data={IRB_TYPES.map((v) => ({ value: v, label: v.replace("_", " ") }))}
            value={type}
            onChange={setType}
          />
          <TextInput
            label="Committee"
            value={committee}
            onChange={(e) => setCommittee(e.currentTarget.value)}
            placeholder="Institutional Ethics Committee"
          />
          <TextInput
            label="Reference no."
            value={ref}
            onChange={(e) => setRef(e.currentTarget.value)}
          />
        </Group>
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Record submission
        </Button>
        <Text fw={600} size="sm">
          Submissions ({subs.length})
        </Text>
        {subs.length === 0 ? (
          <Text size="sm" c="dimmed">
            No ethics submissions recorded.
          </Text>
        ) : (
          subs.map((s) => (
            <Group key={s.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  <Badge tone="neutral" size="xs">
                    {s.submission_type.replace("_", " ")}
                  </Badge>
                  <Badge tone={irbTone(s.status)} size="xs">
                    {s.status.replace("_", " ")}
                  </Badge>
                  <Text size="sm">{s.committee_name}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {s.reference_number ? `${s.reference_number} · ` : ""}
                  {new Date(s.submitted_date).toLocaleDateString()}
                </Text>
              </Stack>
              <Select
                size="xs"
                w={140}
                data={IRB_STATUS.map((v) => ({ value: v, label: v.replace("_", " ") }))}
                value={s.status}
                onChange={(v) => v && update.mutate({ id: s.id, status: v })}
                aria-label="Decision"
              />
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}

export function ClinicalTrialsPage() {
  useRequirePermission("specialty.clinical_trials.list");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [modalOpen, modal] = useDisclosure(false);
  const [candidatesTrial, setCandidatesTrial] = useState<ClinicalTrial | null>(null);
  const [consentsTrial, setConsentsTrial] = useState<ClinicalTrial | null>(null);
  const [visitsTrial, setVisitsTrial] = useState<ClinicalTrial | null>(null);
  const [aeTrial, setAeTrial] = useState<ClinicalTrial | null>(null);
  const [randTrial, setRandTrial] = useState<ClinicalTrial | null>(null);
  const [irbTrial, setIrbTrial] = useState<ClinicalTrial | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["clinical-trials", filter],
    queryFn: () => clinicalTrialsService.listClinicalTrials(filter ?? undefined),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateClinicalTrial(v.id, { status: v.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      toast.success("Status updated", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const exportM = useMutation({
    mutationFn: (trial: ClinicalTrial) =>
      clinicalTrialsService.exportTrial(trial.id).then((data) => ({ data, trial })),
    onSuccess: ({ data, trial }) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial-${trial.protocol_number}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Export failed" }),
  });

  const columns: Column<ClinicalTrial>[] = [
    { key: "protocol_number", label: "Protocol", render: (r) => r.protocol_number },
    { key: "title", label: "Title", render: (r) => r.title },
    { key: "sponsor", label: "Sponsor", render: (r) => r.sponsor || "—" },
    { key: "phase", label: "Phase", render: (r) => (r.phase ? `Phase ${r.phase}` : "—") },
    {
      key: "target_enrollment",
      label: "Target",
      render: (r) => r.target_enrollment ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Group gap="xs">
          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
          <Select
            size="xs"
            w={130}
            data={STATUSES.map((v) => ({ value: v, label: v }))}
            value={r.status}
            onChange={(v) => v && update.mutate({ id: r.id, status: v })}
            aria-label="Change status"
          />
        </Group>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          <Button size="xs" tone="secondary" onClick={() => setCandidatesTrial(r)}>
            Candidates
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setConsentsTrial(r)}>
            Consents
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setVisitsTrial(r)}>
            Visits
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setAeTrial(r)}>
            AEs
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setRandTrial(r)}>
            Randomize
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setIrbTrial(r)}>
            Ethics
          </Button>
          <Button
            size="xs"
            tone="ghost"
            loading={exportM.isPending}
            onClick={() => exportM.mutate(r)}
          >
            Export
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Clinical trials"
        subtitle="Research trial registry — recruiting, active & completed"
        icon={<IconFlask2 size={20} />}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Register trial
          </Button>
        }
      />
      <Select
        placeholder="All statuses"
        data={STATUSES.map((v) => ({ value: v, label: v }))}
        value={filter}
        onChange={setFilter}
        clearable
        maw={220}
        aria-label="Filter by status"
      />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No clinical trials registered."
      />
      <CreateTrialModal opened={modalOpen} onClose={modal.close} />
      {candidatesTrial && (
        <CandidatesModal trial={candidatesTrial} onClose={() => setCandidatesTrial(null)} />
      )}
      {consentsTrial && (
        <ConsentsModal trial={consentsTrial} onClose={() => setConsentsTrial(null)} />
      )}
      {visitsTrial && <VisitsModal trial={visitsTrial} onClose={() => setVisitsTrial(null)} />}
      {aeTrial && <AeModal trial={aeTrial} onClose={() => setAeTrial(null)} />}
      {randTrial && <RandomizationModal trial={randTrial} onClose={() => setRandTrial(null)} />}
      {irbTrial && <IrbModal trial={irbTrial} onClose={() => setIrbTrial(null)} />}
    </Stack>
  );
}
