// BLOOD-BANK TransfusionsTab — split from blood-bank.tsx (pure move).

import { Drawer, Group, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateTransfusionRequest, TransfusionRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconActivity, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { ConsentGateNotice } from "@/components/Consent/ConsentGateNotice";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { useConsentGate } from "@/hooks/useConsentGate";
import { TransfusionMonitorDrawer } from "@/pages/blood-bank/TransfusionMonitorDrawer";
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
  const consentSettled =
    consentGate.outcome === "allow" || consentGate.outcome === "checking" || consentOverride;

  return (
    <Stack>
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <TextInput
        label="Component ID"
        required
        value={componentId}
        onChange={(e) => setComponentId(e.currentTarget.value)}
        placeholder="Blood component UUID"
      />
      <TextInput
        label="Crossmatch ID"
        value={crossmatchId}
        onChange={(e) => setCrossmatchId(e.currentTarget.value)}
        placeholder="Optional crossmatch UUID"
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
        disabled={twoPersonInvalid || !consentSettled}
        onClick={() => {
          if (!patientId || !componentId || !patientVerifier || !productVerifier) return;
          if (patientVerifier === productVerifier) return;
          onSubmit({
            patient_id: patientId,
            component_id: componentId,
            crossmatch_id: crossmatchId || undefined,
            patient_verified_by: patientVerifier,
            product_verified_by: productVerifier,
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
  const [monitorId, setMonitorId] = useState<string | null>(null);

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
      label: "Component",
      render: (t: TransfusionRecord) => t.component_id.slice(0, 8),
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
    ...(canCreate
      ? [
          {
            key: "id" as const,
            label: "Actions",
            render: (t: TransfusionRecord) => (
              <Group gap={4}>
                <Button
                  tone="ghost"
                  size="compact-xs"
                  leftSection={<IconActivity size={14} />}
                  onClick={() => setMonitorId(t.id)}
                >
                  Monitor
                </Button>
                {!t.has_reaction && (
                  <Button
                    tone="subtle-danger"
                    size="compact-xs"
                    onClick={() => setReactionId(t.id)}
                  >
                    Report Reaction
                  </Button>
                )}
              </Group>
            ),
          },
        ]
      : []),
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

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Record Transfusion"
        position="right"
        size="xl"
      >
        <CreateTransfusionForm
          onSubmit={(d) => createMut.mutate(d)}
          loading={createMut.isPending}
        />
      </Drawer>

      <Drawer
        opened={!!reactionId}
        onClose={() => setReactionId(null)}
        title="Report Transfusion Reaction"
        position="right"
        size="md"
      >
        {reactionId && (
          <RecordReactionForm
            onSubmit={(data) => reactionMut.mutate({ id: reactionId, ...data })}
            loading={reactionMut.isPending}
          />
        )}
      </Drawer>

      <TransfusionMonitorDrawer transfusionId={monitorId} onClose={() => setMonitorId(null)} />
    </Stack>
  );
}
