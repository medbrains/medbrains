import { Drawer, Group, NumberInput, Stack, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDnrOrderRequest,
  CreateMortuaryRecordRequest,
  CreatePainAssessmentRequest,
  DnrOrder,
  MortuaryRecord,
  NuclearMedSource,
  PainAssessment,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { specialtyService } from "@/services/specialty.service";

const DNR_TONES: Record<string, BadgeTone> = {
  active: "danger",
  expired: "neutral",
  revoked: "warning",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  primary: "primary",
  blue: "info",
  teal: "success",
  green: "success",
  orange: "warning",
  violet: "accent",
  grape: "accent",
  red: "danger",
  gray: "neutral",
  slate: "neutral",
};

function statusTone(status: string): BadgeTone {
  return STATUS_TONE[statusColor(status) ?? "slate"] ?? "neutral";
}

const PALLIATIVE_PAGE_PERMISSIONS = [
  P.SPECIALTY.PALLIATIVE.DNR_LIST,
  P.SPECIALTY.PALLIATIVE.DNR_MANAGE,
  P.SPECIALTY.PALLIATIVE.PAIN_LIST,
  P.SPECIALTY.PALLIATIVE.PAIN_CREATE,
  P.SPECIALTY.PALLIATIVE.MORTUARY_LIST,
  P.SPECIALTY.PALLIATIVE.MORTUARY_MANAGE,
  P.SPECIALTY.PALLIATIVE.NUCMED_LIST,
  P.SPECIALTY.PALLIATIVE.NUCMED_CREATE,
  P.SPECIALTY.PALLIATIVE.NUCMED_MANAGE,
] as const;

export function PalliativePage() {
  useRequirePermission(PALLIATIVE_PAGE_PERMISSIONS);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const canViewDnr = useHasPermission(P.SPECIALTY.PALLIATIVE.DNR_LIST);
  const canDnr = useHasPermission(P.SPECIALTY.PALLIATIVE.DNR_MANAGE);
  const canViewPain = useHasPermission(P.SPECIALTY.PALLIATIVE.PAIN_LIST);
  const canPain = useHasPermission(P.SPECIALTY.PALLIATIVE.PAIN_CREATE);
  const canViewMortuary = useHasPermission(P.SPECIALTY.PALLIATIVE.MORTUARY_LIST);
  const canMortuary = useHasPermission(P.SPECIALTY.PALLIATIVE.MORTUARY_MANAGE);
  const canViewNucmed = useHasPermission(P.SPECIALTY.PALLIATIVE.NUCMED_LIST);
  const canOpenDnr = canViewDnr || canDnr;
  const canOpenPain = canViewPain || canPain;
  const canOpenMortuary = canViewMortuary || canMortuary;
  const canOpenNucmed = canViewNucmed;
  const requestedTab = searchParams.get("tab");
  const requestedAction = searchParams.get("action");
  const requestedAdmissionId = searchParams.get("admission_id");
  const initialTab =
    requestedTab === "mortuary" && canOpenMortuary
      ? "mortuary"
      : requestedTab === "pain" && canOpenPain
        ? "pain"
        : requestedTab === "nucmed" && canOpenNucmed
          ? "nucmed"
          : canOpenDnr
            ? "dnr"
            : canOpenPain
              ? "pain"
              : canOpenMortuary
                ? "mortuary"
                : "nucmed";

  const [tab, setTab] = useState<string | null>(initialTab);
  const [dnrOpen, dnrHandlers] = useDisclosure(false);
  const [painOpen, painHandlers] = useDisclosure(false);
  const [mortuaryOpen, mortuaryHandlers] = useDisclosure(
    requestedTab === "mortuary" && requestedAction === "new" && canMortuary,
  );

  const { data: dnrOrders = [], isLoading: dnrLoading } = useQuery({
    queryKey: ["dnr-orders"],
    queryFn: () => specialtyService.listDnrOrders(),
    enabled: canViewDnr,
  });
  const { data: painRecords = [] } = useQuery({
    queryKey: ["pain-assessments"],
    queryFn: () => specialtyService.listPainAssessments(),
    enabled: canViewPain,
  });
  const { data: mortuaryRecords = [] } = useQuery({
    queryKey: ["mortuary-records"],
    queryFn: () => specialtyService.listMortuaryRecords(),
    enabled: canViewMortuary,
  });
  const { data: nucSources = [] } = useQuery({
    queryKey: ["nuclear-sources"],
    queryFn: () => specialtyService.listNuclearSources(),
    enabled: canViewNucmed,
  });

  const [dnrForm, setDnrForm] = useState<CreateDnrOrderRequest>({ patient_id: "" });
  const [painForm, setPainForm] = useState<CreatePainAssessmentRequest>({
    patient_id: "",
    pain_score: 0,
  });
  const [mortForm, setMortForm] = useState<CreateMortuaryRecordRequest>({
    body_receipt_number: requestedAdmissionId
      ? `IPD-${requestedAdmissionId.slice(0, 8).toUpperCase()}`
      : "",
    deceased_name: "",
  });

  const createDnr = useMutation({
    mutationFn: (data: CreateDnrOrderRequest) => specialtyService.createDnrOrder(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dnr-orders"] });
      dnrHandlers.close();
      notifications.show({
        title: "Created",
        message: "DNR order created (48hr review)",
        color: "success",
      });
    },
  });

  const revokeDnr = useMutation({
    mutationFn: (id: string) => specialtyService.revokeDnrOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dnr-orders"] });
      notifications.show({ title: "Revoked", message: "DNR order revoked", color: "warning" });
    },
  });

  const createPain = useMutation({
    mutationFn: (data: CreatePainAssessmentRequest) => specialtyService.createPainAssessment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pain-assessments"] });
      painHandlers.close();
      notifications.show({
        title: "Created",
        message: "Pain assessment recorded",
        color: "success",
      });
    },
  });

  const createMort = useMutation({
    mutationFn: (data: CreateMortuaryRecordRequest) => specialtyService.createMortuaryRecord(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mortuary-records"] });
      mortuaryHandlers.close();
      notifications.show({
        title: "Created",
        message: "Mortuary record created",
        color: "success",
      });
    },
  });

  const dnrCols: Column<DnrOrder>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={DNR_TONES[r.status] ?? "neutral"}>{r.status.toUpperCase()}</Badge>
      ),
    },
    {
      key: "review_due",
      label: "Review Due",
      render: (r) => (
        <Text size="sm" c={new Date(r.review_due_at) < new Date() ? "danger" : undefined}>
          {new Date(r.review_due_at).toLocaleString()}
        </Text>
      ),
    },
    { key: "scope", label: "Scope", render: (r) => <Text size="sm">{r.scope ?? "Full DNR"}</Text> },
    {
      key: "authorized",
      label: "Authorized By",
      render: (r) => <Text size="sm">{r.authorized_by.slice(0, 8)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "active" && canDnr ? (
          <IconButton tone="danger" onClick={() => revokeDnr.mutate(r.id)} aria-label="Close">
            <IconX size={16} />
          </IconButton>
        ) : null,
    },
  ];

  const painCols: Column<PainAssessment>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "pain_score",
      label: "Pain Score",
      render: (r) => (
        <Badge tone={r.pain_score >= 7 ? "danger" : r.pain_score >= 4 ? "warning" : "success"}>
          {r.pain_score}/10
        </Badge>
      ),
    },
    {
      key: "who_ladder",
      label: "WHO Ladder",
      render: (r) => <Text size="sm">Step {r.who_ladder_step ?? "---"}</Text>,
    },
    {
      key: "opioid",
      label: "Morphine Eq (mg)",
      render: (r) => <Text size="sm">{r.opioid_dose_morphine_eq ?? "---"}</Text>,
    },
    {
      key: "breakthrough",
      label: "Breakthroughs",
      render: (r) => <Text size="sm">{r.breakthrough_doses ?? "---"}</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const mortCols: Column<MortuaryRecord>[] = [
    {
      key: "receipt",
      label: "Receipt #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.body_receipt_number}
        </Text>
      ),
    },
    { key: "name", label: "Deceased", render: (r) => <Text size="sm">{r.deceased_name}</Text> },
    {
      key: "mlc",
      label: "MLC",
      render: (r) => (r.is_mlc ? <Badge tone="danger">MLC</Badge> : <Text size="sm">No</Text>),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "storage",
      label: "Storage Slot",
      render: (r) => <Text size="sm">{r.cold_storage_slot ?? "---"}</Text>,
    },
    {
      key: "organ",
      label: "Organ Donation",
      render: (r) => <Text size="sm">{r.organ_donation_status ?? "---"}</Text>,
    },
  ];

  const nucSourceCols: Column<NuclearMedSource>[] = [
    {
      key: "isotope",
      label: "Isotope",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.isotope}
        </Text>
      ),
    },
    {
      key: "activity",
      label: "Activity (mCi)",
      render: (r) => <Text size="sm">{r.activity_mci}</Text>,
    },
    {
      key: "half_life",
      label: "Half-life (h)",
      render: (r) => <Text size="sm">{r.half_life_hours}</Text>,
    },
    {
      key: "aerb",
      label: "AERB License",
      render: (r) => <Text size="sm">{r.aerb_license_number ?? "---"}</Text>,
    },
    {
      key: "active",
      label: "Active",
      render: (r) =>
        r.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Palliative, Mortuary & Nuclear Medicine"
        subtitle="End-of-life care, body management, and radiopharmaceuticals"
        actions={
          <Group>
            {canDnr && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={dnrHandlers.open}
              >
                New DNR
              </Button>
            )}
            {canPain && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                onClick={painHandlers.open}
              >
                Pain Assessment
              </Button>
            )}
            {canMortuary && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                onClick={mortuaryHandlers.open}
              >
                Mortuary Record
              </Button>
            )}
          </Group>
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          {canOpenDnr && <Tabs.Tab value="dnr">DNR Orders</Tabs.Tab>}
          {canOpenPain && <Tabs.Tab value="pain">Pain Assessment</Tabs.Tab>}
          {canOpenMortuary && <Tabs.Tab value="mortuary">Mortuary</Tabs.Tab>}
          {canOpenNucmed && <Tabs.Tab value="nucmed">Nuclear Medicine</Tabs.Tab>}
        </Tabs.List>
        {canOpenDnr && (
          <Tabs.Panel value="dnr" pt="md">
            {canViewDnr ? (
              <DataTable
                columns={dnrCols}
                data={dnrOrders}
                loading={dnrLoading}
                rowKey={(r) => r.id}
              />
            ) : (
              <Text c="dimmed" size="sm">
                DNR list access is required to view existing orders.
              </Text>
            )}
          </Tabs.Panel>
        )}
        {canOpenPain && (
          <Tabs.Panel value="pain" pt="md">
            {canViewPain ? (
              <DataTable
                columns={painCols}
                data={painRecords}
                loading={false}
                rowKey={(r) => r.id}
              />
            ) : (
              <Text c="dimmed" size="sm">
                Pain-assessment list access is required to view existing records.
              </Text>
            )}
          </Tabs.Panel>
        )}
        {canOpenMortuary && (
          <Tabs.Panel value="mortuary" pt="md">
            {canViewMortuary ? (
              <DataTable
                columns={mortCols}
                data={mortuaryRecords}
                loading={false}
                rowKey={(r) => r.id}
              />
            ) : (
              <Text c="dimmed" size="sm">
                Mortuary list access is required to view existing body records.
              </Text>
            )}
          </Tabs.Panel>
        )}
        {canOpenNucmed && (
          <Tabs.Panel value="nucmed" pt="md">
            <Stack>
              <Text fw={600}>Radioactive Sources</Text>
              <DataTable
                columns={nucSourceCols}
                data={nucSources}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>
      <Drawer
        opened={dnrOpen}
        onClose={dnrHandlers.close}
        title="New DNR Order"
        size="md"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={dnrForm.patient_id}
            onChange={(patientId) => setDnrForm((p) => ({ ...p, patient_id: patientId }))}
          />
          <TextInput
            label="Admission ID"
            value={dnrForm.admission_id ?? ""}
            onChange={(e) => setDnrForm((p) => ({ ...p, admission_id: e.currentTarget.value }))}
          />
          <TextInput
            label="Scope"
            placeholder="Full DNR, Limited, etc."
            value={dnrForm.scope ?? ""}
            onChange={(e) => setDnrForm((p) => ({ ...p, scope: e.currentTarget.value }))}
          />
          <Button
            tone="primary"
            onClick={() => createDnr.mutate(dnrForm)}
            loading={createDnr.isPending}
          >
            Create DNR Order
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={painOpen}
        onClose={painHandlers.close}
        title="Pain Assessment"
        size="md"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={painForm.patient_id}
            onChange={(patientId) => setPainForm((p) => ({ ...p, patient_id: patientId }))}
          />
          <NumberInput
            label="Pain Score (0-10)"
            required
            min={0}
            max={10}
            value={painForm.pain_score}
            onChange={(v) =>
              setPainForm((p) => ({ ...p, pain_score: typeof v === "number" ? v : 0 }))
            }
          />
          <NumberInput
            label="WHO Ladder Step (1-3)"
            min={1}
            max={3}
            value={painForm.who_ladder_step ?? ""}
            onChange={(v) =>
              setPainForm((p) => ({ ...p, who_ladder_step: typeof v === "number" ? v : undefined }))
            }
          />
          <NumberInput
            label="Opioid Dose (Morphine Eq mg)"
            value={painForm.opioid_dose_morphine_eq ?? ""}
            onChange={(v) =>
              setPainForm((p) => ({
                ...p,
                opioid_dose_morphine_eq: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <NumberInput
            label="Breakthrough Doses"
            value={painForm.breakthrough_doses ?? ""}
            onChange={(v) =>
              setPainForm((p) => ({
                ...p,
                breakthrough_doses: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <Button
            tone="primary"
            onClick={() => createPain.mutate(painForm)}
            loading={createPain.isPending}
          >
            Record Assessment
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={mortuaryOpen}
        onClose={mortuaryHandlers.close}
        title="New Mortuary Record"
        size="md"
        position="right"
      >
        <Stack>
          <TextInput
            label="Body Receipt Number"
            required
            value={mortForm.body_receipt_number}
            onChange={(e) =>
              setMortForm((p) => ({ ...p, body_receipt_number: e.currentTarget.value }))
            }
          />
          <TextInput
            label="Deceased Name"
            required
            value={mortForm.deceased_name}
            onChange={(e) => setMortForm((p) => ({ ...p, deceased_name: e.currentTarget.value }))}
          />
          <Switch
            label="MLC Case"
            checked={mortForm.is_mlc ?? false}
            onChange={(e) => setMortForm((p) => ({ ...p, is_mlc: e.currentTarget.checked }))}
          />
          <TextInput
            label="MLC Case ID"
            value={mortForm.mlc_case_id ?? ""}
            onChange={(e) => setMortForm((p) => ({ ...p, mlc_case_id: e.currentTarget.value }))}
          />
          <TextInput
            label="Cold Storage Slot"
            value={mortForm.cold_storage_slot ?? ""}
            onChange={(e) =>
              setMortForm((p) => ({ ...p, cold_storage_slot: e.currentTarget.value }))
            }
          />
          <Button
            tone="primary"
            onClick={() => createMort.mutate(mortForm)}
            loading={createMort.isPending}
          >
            Create Record
          </Button>
        </Stack>
      </Drawer>
    </div>
  );
}
