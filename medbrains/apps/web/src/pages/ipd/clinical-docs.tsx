// IPD ClinicalDocsTab — split from ipd.tsx (pure move).

import { Card, Group, Select, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateClinicalDocRequest,
  CreateRestraintCheckRequest,
  IpdClinicalDocType,
  IpdClinicalDocumentation,
  RestraintCheckStatus,
  RestraintMonitoringLog,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

const DOC_TYPE_OPTIONS: { value: IpdClinicalDocType; label: string }[] = [
  { value: "wound_care", label: "Wound Care" },
  { value: "central_line", label: "Central Line" },
  { value: "catheter", label: "Catheter" },
  { value: "drain", label: "Drain" },
  { value: "restraint", label: "Restraint" },
  { value: "transfusion", label: "Transfusion" },
  { value: "blood_transfusion_checklist", label: "Blood Transfusion Checklist" },
  { value: "elopement_risk", label: "Elopement Risk Assessment" },
  { value: "dialysis", label: "Dialysis Nursing" },
  { value: "endoscopy", label: "Endoscopy Nursing" },
  { value: "chemotherapy", label: "Chemotherapy Administration" },
  { value: "clinical_pathway", label: "Clinical Pathway" },
  { value: "other", label: "Other" },
];

const RESTRAINT_STATUS_OPTIONS: { value: RestraintCheckStatus; label: string }[] = [
  { value: "circulation_ok", label: "Circulation OK" },
  { value: "skin_intact", label: "Skin Intact" },
  { value: "repositioned", label: "Repositioned" },
  { value: "released", label: "Released" },
  { value: "escalated", label: "Escalated" },
];

function RestraintChecksSummary({ admissionId, docId }: { admissionId: string; docId: string }) {
  const { data } = useQuery({
    queryKey: ["restraint-checks", admissionId, docId],
    queryFn: () => ipdService.listRestraintChecks(admissionId, docId),
    refetchInterval: 60_000,
  });

  const checks = (data ?? []) as RestraintMonitoringLog[];
  const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null;
  const isOverdue = lastCheck
    ? Date.now() - new Date(lastCheck.check_time).getTime() > 30 * 60 * 1000
    : true;

  return (
    <Group gap={4}>
      <Badge size="xs">{checks.length} checks</Badge>
      {lastCheck && (
        <Tooltip
          label={`Last: ${new Date(lastCheck.check_time).toLocaleString()} — ${lastCheck.status.replace(/_/g, " ")}`}
        >
          <Badge size="xs" tone={isOverdue ? "danger" : "success"} variant="filled">
            {isOverdue ? "OVERDUE" : "OK"}
          </Badge>
        </Tooltip>
      )}
      {!lastCheck && (
        <Badge size="xs" tone="danger" variant="filled">
          No checks
        </Badge>
      )}
    </Group>
  );
}

export function ClinicalDocsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string | null>(null);
  const [formOpened, formHandlers] = useDisclosure(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [restraintDocId, setRestraintDocId] = useState<string | null>(null);
  const [restraintStatus, setRestraintStatus] = useState<string | null>(null);
  const [restraintNotes, setRestraintNotes] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["ipd-clinical-docs", admissionId, filterType],
    queryFn: () =>
      ipdService.listClinicalDocs(admissionId, filterType ? { doc_type: filterType } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateClinicalDocRequest) => ipdService.createClinicalDoc(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      toast.success("Clinical documentation saved", { title: "Created" });
      formHandlers.close();
      setDocType(null);
      setTitle("");
      setNotes("");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (docId: string) => ipdService.resolveClinicalDoc(admissionId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      toast.success("Documentation marked as resolved", { title: "Resolved" });
    },
  });

  const restraintMutation = useMutation({
    mutationFn: (data: CreateRestraintCheckRequest) =>
      ipdService.createRestraintCheck(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      toast.success("Restraint check logged", { title: "Recorded" });
      setRestraintDocId(null);
      setRestraintStatus(null);
      setRestraintNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not log restraint check" }),
  });

  const rows = docs ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Filter by type"
          data={DOC_TYPE_OPTIONS}
          value={filterType}
          onChange={setFilterType}
          clearable
          w={200}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={() => formHandlers.open()}
          >
            Add Documentation
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select
              label="Type"
              data={DOC_TYPE_OPTIONS}
              value={docType}
              onChange={setDocType}
              required
            />
            <TextInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />
            {docType === "central_line" && (
              <Text size="xs" c="dimmed">
                Structured: insertion site (subclavian/jugular/femoral), line type, daily assessment
                — stored in body JSONB
              </Text>
            )}
            {docType === "catheter" && (
              <Text size="xs" c="dimmed">
                Structured: catheter type (Foley/suprapubic/condom), size, daily assessment — stored
                in body JSONB
              </Text>
            )}
            {docType === "transfusion" && (
              <Text size="xs" c="dimmed">
                Structured: blood product type, unit number, donation ID, pre-transfusion vitals,
                reaction monitoring — stored in body JSONB
              </Text>
            )}
            {docType === "restraint" && (
              <Text size="xs" c="dimmed">
                Structured: restraint type, reason, physician order. 30-min monitoring checks logged
                separately.
              </Text>
            )}
            {docType === "blood_transfusion_checklist" && (
              <Card withBorder p="xs" bg="blue.0">
                <Text size="xs" fw={500} mb={4}>
                  Blood Transfusion Checklist (WHO Protocol)
                </Text>
                <Text size="xs" c="dimmed">
                  Pre-transfusion: patient ID (2 identifiers), consent verified, blood group
                  crossmatch, vitals (temp/BP/HR/RR/SpO2).
                </Text>
                <Text size="xs" c="dimmed">
                  Interval checks: 15-min, 30-min, 60-min, 120-min — vitals + reaction monitoring at
                  each.
                </Text>
                <Text size="xs" c="dimmed">
                  Reaction types: febrile, allergic, hemolytic, TRALI, TACO, other. Severity +
                  action taken logged.
                </Text>
              </Card>
            )}
            {docType === "elopement_risk" && (
              <Card withBorder p="xs" bg="orange.0">
                <Text size="xs" fw={500} mb={4}>
                  Elopement Risk Assessment
                </Text>
                <Text size="xs" c="dimmed">
                  Risk factors: psychiatric diagnosis, MLC patient, confused state, dementia,
                  substance withdrawal, previous elopement, suicidal ideation.
                </Text>
                <Text size="xs" c="dimmed">
                  Auto-scores risk (low/medium/high/critical). Precautions: 1:1 watch, door alarms,
                  colored wristband, family notification.
                </Text>
              </Card>
            )}
            {docType === "dialysis" && (
              <Card withBorder p="xs" bg="teal.0">
                <Text size="xs" fw={500} mb={4}>
                  Dialysis Nursing (Pre/Intra/Post)
                </Text>
                <Text size="xs" c="dimmed">
                  Pre: dry weight, access type/site, machine params (blood flow, dialysate flow, UF
                  goal).
                </Text>
                <Text size="xs" c="dimmed">
                  Intra: hourly vitals, UF removed, machine alarms, interventions.
                </Text>
                <Text size="xs" c="dimmed">
                  Post: post-weight, fluid removed, access site check, complications.
                </Text>
              </Card>
            )}
            {docType === "endoscopy" && (
              <Card withBorder p="xs" bg="grape.0">
                <Text size="xs" fw={500} mb={4}>
                  Endoscopy Nursing (Aldrete Score)
                </Text>
                <Text size="xs" c="dimmed">
                  Sedation: drugs (name, dose, time), sedation level. Monitoring: vitals at 5-min
                  intervals.
                </Text>
                <Text size="xs" c="dimmed">
                  Modified Aldrete: activity (0-2), respiration (0-2), circulation (0-2),
                  consciousness (0-2), SpO2 (0-2).
                </Text>
                <Text size="xs" c="dimmed">
                  Score 9+ = discharge ready. Complications: perforation, bleeding, aspiration,
                  cardiopulmonary.
                </Text>
              </Card>
            )}
            {docType === "chemotherapy" && (
              <Card withBorder p="xs" bg="red.0">
                <Text size="xs" fw={500} mb={4}>
                  Chemotherapy Administration (CTCAE Grading)
                </Text>
                <Text size="xs" c="dimmed">
                  Protocol, cycle number, drug list, doses, infusion rates. Pre-medications
                  administered.
                </Text>
                <Text size="xs" c="dimmed">
                  Vitals: baseline + q15min x4 + q30min. Adverse reactions (CTCAE grade 1-5),
                  extravasation check.
                </Text>
                <Badge size="xs" tone="danger" mt={4}>
                  Requires chemo certification verification
                </Badge>
              </Card>
            )}
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    doc_type: docType as IpdClinicalDocType,
                    title,
                    notes: notes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!docType || !title}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No clinical documentation recorded yet.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Recorded</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((doc: IpdClinicalDocumentation) => (
              <Table.Tr key={doc.id}>
                <Table.Td>
                  <Badge size="sm">{doc.doc_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{doc.title}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(doc.recorded_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  {doc.is_resolved ? (
                    <Badge tone="success" size="sm">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="sm">
                      Active
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {!doc.is_resolved && canCreate && (
                      <IconButton
                        size="sm"
                        tone="success"
                        aria-label="Approve"
                        onClick={() => resolveMutation.mutate(doc.id)}
                      >
                        <IconCheck size={14} />
                      </IconButton>
                    )}
                    {doc.doc_type === "restraint" && !doc.is_resolved && (
                      <>
                        <Button
                          tone="secondary"
                          size="xs"
                          onClick={() => setRestraintDocId(doc.id)}
                        >
                          Log Check
                        </Button>
                        <RestraintChecksSummary admissionId={admissionId} docId={doc.id} />
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {restraintDocId && (
        <Card withBorder p="sm">
          <Text fw={500} size="sm" mb="xs">
            30-Minute Restraint Check
          </Text>
          <Stack gap="xs">
            <Select
              label="Status"
              data={RESTRAINT_STATUS_OPTIONS}
              value={restraintStatus}
              onChange={setRestraintStatus}
              required
            />
            <Textarea
              label="Notes"
              value={restraintNotes}
              onChange={(e) => setRestraintNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  restraintMutation.mutate({
                    clinical_doc_id: restraintDocId,
                    status: restraintStatus as RestraintCheckStatus,
                    notes: restraintNotes || undefined,
                  })
                }
                loading={restraintMutation.isPending}
                disabled={!restraintStatus}
              >
                Record Check
              </Button>
              <Button tone="ghost" size="sm" onClick={() => setRestraintDocId(null)}>
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
//  IPD Phase 2b — Admission Checklist
// ══════════════════════════════════════════════════════════
