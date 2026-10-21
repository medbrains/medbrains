// BLOOD-BANK TransfusionsTab — split from blood-bank.tsx (pure move).

import { Group, Select, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateTransfusionRequest, TransfusionRecord } from "@medbrains/types";
import { bloodGroupLabel, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { ConsentGateNotice } from "@/components/Consent/ConsentGateNotice";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PrintDocumentIconMenu } from "@/components/Print/PrintDocumentIconMenu";
import { Alert, Badge, Button, Modal, Switch, TextArea, toast } from "@/components/ui";
import { useConsentGate } from "@/hooks/useConsentGate";
import { adminAccessService } from "@/services/adminAccess.service";
import { bloodBankService } from "@/services/bloodBank.service";

const TRANSFUSION_REACTION_TYPES = [
  { value: "febrile", label: "Febrile Non-Hemolytic" },
  { value: "allergic_mild", label: "Allergic (Mild)" },
  { value: "allergic_severe", label: "Allergic (Severe/Anaphylactic)" },
  { value: "hemolytic_acute", label: "Acute Hemolytic" },
  { value: "hemolytic_delayed", label: "Delayed Hemolytic" },
  { value: "trali", label: "TRALI (Transfusion-Related Acute Lung Injury)" },
  { value: "taco", label: "TACO (Transfusion-Associated Circulatory Overload)" },
  { value: "septic", label: "Septic/Bacterial" },
  { value: "hypotensive", label: "Hypotensive" },
  { value: "pta_gvhd", label: "PTA-GVHD" },
  { value: "other", label: "Other" },
];

function CreateTransfusionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: CreateTransfusionRequest) => void;
  loading: boolean;
}) {
  const [patientId, setPatientId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [crossmatchId, setCrossmatchId] = useState("");
  const [patientVerifier, setPatientVerifier] = useState<string | null>(null);
  const [productVerifier, setProductVerifier] = useState<string | null>(null);
  // Uncrossmatched O-negative for a life-threatening bleed: its own
  // permission, a mandatory reason, and the server audits every use.
  const canEmergencyRelease = useHasPermission(P.BLOOD_BANK.TRANSFUSION_EMERGENCY_RELEASE);
  const [emergency, setEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
  });
  const userData = users.map((u) => ({ value: u.id, label: u.full_name }));
  const twoPersonInvalid =
    !patientVerifier || !productVerifier || patientVerifier === productVerifier;
  // Transfusion consent, checked beside the two-person bedside verification
  // rather than after the line is in. Like that check it does not block on its
  // own: a transfusion refused because a consent lookup timed out can kill the
  // patient it was meant to protect.
  const consentGate = useConsentGate({
    patientId,
    procedureType: "blood_transfusion",
  });
  const [consentOverride, setConsentOverride] = useState(false);

  // A blood bag chosen by typing a UUID is a blood bag chosen by whoever
  // pasted last. These are the units the bank can actually issue, named the
  // way the label names them.
  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ["blood-components", "issuable"],
    queryFn: () => bloodBankService.listBloodComponents({ status: "available" }),
  });
  const componentOptions = components.map((component) => ({
    value: component.id,
    label: `${component.bag_number} · ${bloodGroupLabel(component.blood_group)} ${component.component_type.replace(/_/g, " ")} · exp ${new Date(component.expiry_at).toLocaleDateString()}`,
  }));

  // Scoped to the patient on the form: offering another patient's crossmatch
  // is offering the mistake this screen exists to prevent.
  const { data: crossmatches } = useQuery({
    queryKey: ["crossmatch-requests", patientId],
    queryFn: () => bloodBankService.listCrossmatchRequests({ limit: 100 }),
    enabled: Boolean(patientId),
  });
  const crossmatchOptions = (crossmatches?.data ?? [])
    .filter((request) => request.patient_id === patientId)
    .map((request) => ({
      value: request.id,
      label: `${request.blood_group ?? "group unknown"} · ${request.status}${
        request.result ? ` · ${request.result}` : ""
      }`,
    }));

  const consentSettled =
    consentGate.outcome === "allow" || consentGate.outcome === "checking" || consentOverride;

  return (
    <Stack>
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      {/* Who this is. A transfusion form without the patient's allergies and
          flags in front of the person filling it is the wrong-patient error
          waiting to be made (IPSG-1). */}
      {patientId && <PatientContextBanner patientId={patientId} />}
      <Select
        label="Blood unit"
        description="Bag number, group and expiry — the label you are holding."
        placeholder={componentsLoading ? "Loading units…" : "Select the unit being transfused"}
        data={componentOptions}
        value={componentId || null}
        onChange={(value) => setComponentId(value ?? "")}
        searchable
        required
        nothingFoundMessage="No issuable unit in stock"
      />
      <Select
        label="Crossmatch"
        description="Required for whole blood and PRBC. Left blank, the bank uses this patient's compatible crossmatch for this unit from the last 72 hours; without one the unit is not issued."
        placeholder="Select the crossmatch this unit was matched on"
        data={crossmatchOptions}
        value={crossmatchId || null}
        onChange={(value) => setCrossmatchId(value ?? "")}
        searchable
        clearable
        disabled={!patientId}
        nothingFoundMessage="No crossmatch on record for this patient"
      />
      <Select
        label="Patient verified by (bedside)"
        placeholder="First verifier"
        data={userData}
        value={patientVerifier}
        onChange={setPatientVerifier}
        searchable
        required
      />
      <Select
        label="Blood unit verified by (bedside)"
        placeholder="Second verifier — must differ"
        data={userData}
        value={productVerifier}
        onChange={setProductVerifier}
        searchable
        required
        error={
          patientVerifier && productVerifier && patientVerifier === productVerifier
            ? "The two verifiers must be different people"
            : undefined
        }
      />
      {canEmergencyRelease && (
        <Stack gap="xs">
          <Switch
            label="Emergency uncrossmatched O-negative release"
            checked={emergency}
            onChange={(e) => setEmergency(e.currentTarget.checked)}
          />
          {emergency && (
            <>
              <Alert tone="danger" title="Uncrossmatched blood">
                Only an O-negative red-cell unit is released this way. Send a sample for crossmatch
                now; this release is written to the audit log under your name.
              </Alert>
              <TextArea
                label="Reason"
                description="The emergency and the requesting doctor."
                required
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.currentTarget.value)}
                error={emergencyReason.trim() ? undefined : "A reason is required"}
              />
            </>
          )}
        </Stack>
      )}
      {patientId && (
        <ConsentGateNotice
          outcome={consentGate.outcome}
          procedureLabel="this transfusion"
          overrideAcknowledged={consentOverride}
          onOverrideChange={setConsentOverride}
          onRecheck={consentGate.recheck}
        />
      )}
      <Button
        tone="primary"
        disabled={twoPersonInvalid || !consentSettled || (emergency && !emergencyReason.trim())}
        onClick={() => {
          if (!patientId || !componentId || !patientVerifier || !productVerifier) return;
          if (patientVerifier === productVerifier) return;
          onSubmit({
            patient_id: patientId,
            component_id: componentId,
            crossmatch_id: crossmatchId || undefined,
            patient_verified_by: patientVerifier,
            product_verified_by: productVerifier,
            emergency_release: emergency || undefined,
            emergency_reason: emergency ? emergencyReason.trim() : undefined,
          });
        }}
        loading={loading}
      >
        Start Transfusion
      </Button>
    </Stack>
  );
}

function RecordReactionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    reaction_type: string;
    reaction_severity: string;
    reaction_details?: string;
  }) => void;
  loading: boolean;
}) {
  const [reactionType, setReactionType] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  return (
    <Stack>
      <Select
        label="Reaction Type"
        required
        data={TRANSFUSION_REACTION_TYPES}
        value={reactionType || null}
        onChange={(v) => setReactionType(v ?? "")}
        searchable
        placeholder="Select reaction type"
      />
      <Select
        label="Severity"
        required
        data={[
          { value: "mild", label: "Mild" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
          { value: "fatal", label: "Fatal" },
        ]}
        value={severity}
        onChange={setSeverity}
      />
      <Textarea
        label="Details"
        value={details}
        onChange={(e) => setDetails(e.currentTarget.value)}
      />
      <Button
        tone="danger"
        onClick={() => {
          if (!reactionType || !severity) return;
          onSubmit({
            reaction_type: reactionType,
            reaction_severity: severity,
            reaction_details: details || undefined,
          });
        }}
        loading={loading}
      >
        Report Reaction
      </Button>
    </Stack>
  );
}

export function TransfusionsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.TRANSFUSION_CREATE);
  // Recording a transfusion is not permission to read the register. An empty
  // transfusion list reads as "this blood was never given".
  const canListTransfusions = useHasPermission(P.BLOOD_BANK.TRANSFUSION_LIST);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [reactionId, setReactionId] = useState<string | null>(null);

  const { data: transfusions, isLoading } = useQuery({
    queryKey: ["blood-bank", "transfusions"],
    queryFn: () => bloodBankService.listTransfusions(),
    enabled: canListTransfusions,
  });

  const createMut = useMutation({
    mutationFn: (d: CreateTransfusionRequest) => bloodBankService.createTransfusion(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank"] });
      closeCreate();
      toast.success("Blood transfusion started", { title: "Transfusion recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not start transfusion" }),
  });

  const reactionMut = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      reaction_type: string;
      reaction_severity: string;
      reaction_details?: string;
    }) =>
      bloodBankService.recordTransfusionReaction(id, {
        reaction_type: data.reaction_type,
        reaction_severity: data.reaction_severity as TransfusionRecord["reaction_severity"] &
          string,
        reaction_details: data.reaction_details,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "transfusions"] });
      setReactionId(null);
      toast.warning("Transfusion reaction has been reported", { title: "Reaction recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record reaction" }),
  });

  const columns = [
    {
      key: "started_at" as const,
      label: "Started",
      render: (t: TransfusionRecord) => new Date(t.started_at).toLocaleString(),
    },
    {
      key: "component_id" as const,
      label: "Unit",
      render: (t: TransfusionRecord) =>
        t.emergency_release ? (
          <Group gap={4}>
            {t.bag_number ?? "Unknown unit"}
            <Badge tone="danger">Emergency O-neg, uncrossmatched</Badge>
          </Group>
        ) : t.bag_number ? (
          `${t.bag_number}${t.component_type ? ` · ${t.component_type.toUpperCase()}` : ""}`
        ) : (
          "Unknown unit"
        ),
    },
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (t: TransfusionRecord) => (
        <PatientNameCell patientId={t.patient_id} showUhid={false} />
      ),
    },
    {
      key: "has_reaction" as const,
      label: "Reaction",
      render: (t: TransfusionRecord) =>
        t.has_reaction ? (
          <Badge tone="danger">Yes — {t.reaction_severity}</Badge>
        ) : (
          <Badge tone="success">None</Badge>
        ),
    },
    {
      key: "completed_at" as const,
      label: "Completed",
      render: (t: TransfusionRecord) =>
        t.completed_at ? new Date(t.completed_at).toLocaleString() : "In progress",
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (t: TransfusionRecord) => (
        <Group gap={4}>
          {canCreate && !t.has_reaction && (
            <Button tone="subtle-danger" size="compact-xs" onClick={() => setReactionId(t.id)}>
              Report Reaction
            </Button>
          )}
          {/* The reaction form is only meaningful once a reaction is recorded. */}
          <PrintDocumentIconMenu
            idKind="transfusion_record"
            recordId={t.id}
            recordLabel="transfusion"
            exclude={t.has_reaction ? [] : ["transfusion-reaction"]}
          />
        </Group>
      ),
    },
  ];

  return (
    <Stack mt="md">
      <Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Record Transfusion
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={transfusions ?? []}
        loading={isLoading}
        rowKey={(t) => t.id}
      />

      <Modal opened={createOpen} onClose={closeCreate} title="Record Transfusion" fullScreen>
        <CreateTransfusionForm
          onSubmit={(d) => createMut.mutate(d)}
          loading={createMut.isPending}
        />
      </Modal>

      <Modal
        opened={!!reactionId}
        onClose={() => setReactionId(null)}
        title="Report Transfusion Reaction"
        size="md"
      >
        {reactionId && (
          <RecordReactionForm
            onSubmit={(data) => reactionMut.mutate({ id: reactionId, ...data })}
            loading={reactionMut.isPending}
          />
        )}
      </Modal>
    </Stack>
  );
}
