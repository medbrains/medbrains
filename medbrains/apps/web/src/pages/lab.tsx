import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconDroplet,
  IconEye,
  IconFlask,
  IconLock,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmendResultRequest,
  CreateCalibrationRequest,
  CreateLabCatalogRequest,
  CreateLabOrderRequest,
  CreateLabPanelRequest,
  CreateOutsourcedOrderRequest,
  CreateQcResultRequest,
  CreateReagentLotRequest,
  CreateHomeCollectionRequest,
  CreateCollectionCenterRequest,
  CreateSampleArchiveRequest,
  CreateEqasResultRequest,
  CreateProficiencyTestRequest,
  CreateNablDocumentRequest,
  CreateHistopathReportRequest,
  CreateCytologyReportRequest,
  CreateMolecularReportRequest,
  CreateB2bClientRequest,
  CreateB2bRateRequest,
  LabCalibration,
  LabCriticalAlert,
  LabOrder,
  LabOrderDetailResponse,
  LabOutsourcedOrder,
  LabPhlebotomyQueueItem,
  LabPriority,
  LabQcResult,
  LabReagentLot,
  LabResult,
  LabResultFlag,
  LabTestCatalog,
  LabTestPanel,
  LabHomeCollection,
  LabCollectionCenter,
  LabSampleArchive,
  LabEqasResult,
  LabProficiencyTest,
  LabNablDocument,
  LabB2bClient,
  LabB2bRate,
  HomeCollectionStatsRow,
  ReagentConsumptionRow,
  ResultInput,
  LabTatAnalyticsRow,
  AutoValidateResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const statusColors: Record<string, string> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "orange",
  verified: "success",
  cancelled: "danger",
};

const priorityColors: Record<string, string> = {
  routine: "slate",
  urgent: "orange",
  stat: "danger",
};

const flagColors: Record<string, string> = {
  normal: "success",
  low: "primary",
  high: "orange",
  critical_low: "danger",
  critical_high: "danger",
  abnormal: "warning",
};

const qcStatusColors: Record<string, string> = {
  accepted: "success",
  rejected: "danger",
  warning: "warning",
};

const outsourceStatusColors: Record<string, string> = {
  pending_send: "slate",
  sent: "primary",
  result_received: "success",
  cancelled: "danger",
};

const phlebotomyStatusColors: Record<string, string> = {
  waiting: "warning",
  in_progress: "primary",
  completed: "success",
  skipped: "slate",
};

// Dropdown options for categorical fields
const SAMPLE_TYPES = [
  { value: "blood", label: "Blood" },
  { value: "serum", label: "Serum" },
  { value: "plasma", label: "Plasma" },
  { value: "urine", label: "Urine" },
  { value: "stool", label: "Stool" },
  { value: "swab", label: "Swab" },
  { value: "csf", label: "CSF (Cerebrospinal Fluid)" },
  { value: "sputum", label: "Sputum" },
  { value: "tissue", label: "Tissue" },
  { value: "aspirate", label: "Aspirate" },
  { value: "other", label: "Other" },
];

const LAB_METHODS = [
  { value: "photometry", label: "Photometry" },
  { value: "elisa", label: "ELISA" },
  { value: "pcr", label: "PCR" },
  { value: "rt_pcr", label: "RT-PCR" },
  { value: "chromatography", label: "Chromatography" },
  { value: "immunoassay", label: "Immunoassay" },
  { value: "spectrophotometry", label: "Spectrophotometry" },
  { value: "electrophoresis", label: "Electrophoresis" },
  { value: "microscopy", label: "Microscopy" },
  { value: "culture", label: "Culture" },
  { value: "flow_cytometry", label: "Flow Cytometry" },
  { value: "sequencing", label: "Sequencing" },
  { value: "other", label: "Other" },
];

const DOCUMENT_TYPES = [
  { value: "sop", label: "SOP" },
  { value: "manual", label: "Manual" },
  { value: "form", label: "Form" },
  { value: "policy", label: "Policy" },
  { value: "work_instruction", label: "Work Instruction" },
  { value: "record", label: "Record" },
  { value: "other", label: "Other" },
];

const B2B_CLIENT_TYPES = [
  { value: "clinic", label: "Clinic" },
  { value: "laboratory", label: "Laboratory" },
  { value: "hospital", label: "Hospital" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "other", label: "Other" },
];

const MOLECULAR_TEST_METHODS = [
  { value: "rt_pcr", label: "RT-PCR" },
  { value: "pcr", label: "PCR" },
  { value: "sequencing", label: "Sequencing (NGS)" },
  { value: "microarray", label: "Microarray" },
  { value: "fish", label: "FISH" },
  { value: "western_blot", label: "Western Blot" },
  { value: "southern_blot", label: "Southern Blot" },
  { value: "other", label: "Other" },
];

const RESULT_INTERPRETATIONS = [
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "indeterminate", label: "Indeterminate" },
  { value: "invalid", label: "Invalid" },
  { value: "detected", label: "Detected" },
  { value: "not_detected", label: "Not Detected" },
];

export function LabPage() {
  useRequirePermission(P.LAB.ORDERS_LIST);

  return (
    <ClinicalEventProvider moduleCode="lab" contextCode="lab-orders">
      <LabPageInner />
    </ClinicalEventProvider>
  );
}

function LabPageInner() {
  const canCreateOrder = useHasPermission(P.LAB.ORDERS_CREATE);
  const canCreateResult = useHasPermission(P.LAB.RESULTS_CREATE);
  const canVerify = useHasPermission(P.LAB.RESULTS_UPDATE);
  const canAmend = useHasPermission(P.LAB.RESULTS_AMEND);
  const canQc = useHasPermission(P.LAB.QC_LIST);
  const canPhlebotomy = useHasPermission(P.LAB.PHLEBOTOMY_LIST);
  const canOutsourced = useHasPermission(P.LAB.OUTSOURCED_LIST);
  const canSamples = useHasPermission(P.LAB.SAMPLES_LIST);
  const canSpecialized = useHasPermission(P.LAB.SPECIALIZED_LIST);
  const canB2b = useHasPermission(P.LAB.B2B_LIST);

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (filterPriority) params.priority = filterPriority;

  const { data, isLoading } = useQuery({
    queryKey: ["lab-orders", params],
    queryFn: () => api.listLabOrders(params),
  });

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabOrder) => <Text size="sm">{row.patient_id.slice(0, 8)}...</Text>,
    },
    {
      key: "test_id",
      label: "Test",
      render: (row: LabOrder) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: LabOrder) => (
        <StatusDot color={priorityColors[row.priority] ?? "slate"} label={row.priority} />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabOrder) => (
        <StatusDot color={statusColors[row.status] ?? "slate"} label={row.status.replace(/_/g, " ")} />
      ),
    },
    {
      key: "report_status",
      label: "Report",
      render: (row: LabOrder) => row.report_status ? (
        <Badge size="xs" variant="light" color={row.is_report_locked ? "danger" : "primary"}>
          {row.report_status}{row.is_report_locked ? " (locked)" : ""}
        </Badge>
      ) : <Text size="sm" c="dimmed">—</Text>,
    },
    {
      key: "created_at",
      label: "Ordered",
      render: (row: LabOrder) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabOrder) => (
        <Group gap="xs">
          <Tooltip label="View">
            <ActionIcon variant="subtle" onClick={() => { setSelectedOrderId(row.id); openDetail(); }}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  // Critical alerts count — general overview
  const { data: criticalAlerts = [] } = useQuery({
    queryKey: ["lab-critical-alerts"],
    queryFn: () => api.listCriticalAlerts(),
    refetchInterval: 30_000,
  });

  const unacknowledgedAlerts = criticalAlerts.filter((a: LabCriticalAlert) => !a.acknowledged_at);

  return (
    <div>
      <PageHeader
        title="Laboratory"
        subtitle="Lab orders, results, QC & compliance"
        icon={<IconFlask size={20} stroke={1.5} />}
        color="violet"
        actions={
          canCreateOrder ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New Order
            </Button>
          ) : undefined
        }
      />

      {unacknowledgedAlerts.length > 0 && (
        <Alert
          color="danger"
          icon={<IconAlertTriangle size={18} />}
          title={`${unacknowledgedAlerts.length} unacknowledged critical alert(s)`}
          mb="md"
          variant="light"
        >
          <Group gap="xs" wrap="wrap">
            {unacknowledgedAlerts.slice(0, 5).map((a: LabCriticalAlert) => (
              <Badge key={a.id} color="danger" variant="filled" size="sm">
                {a.parameter_name}: {a.value} ({a.flag.replace(/_/g, " ")})
              </Badge>
            ))}
            {unacknowledgedAlerts.length > 5 && (
              <Text size="xs" c="danger" fw={500}>+{unacknowledgedAlerts.length - 5} more</Text>
            )}
          </Group>
        </Alert>
      )}

      <Tabs defaultValue="orders">
        <Tabs.List mb="md">
          <Tabs.Tab value="orders">Orders</Tabs.Tab>
          <Tabs.Tab value="catalog">Test Catalog</Tabs.Tab>
          <Tabs.Tab value="panels">Panels / Profiles</Tabs.Tab>
          {canPhlebotomy && <Tabs.Tab value="phlebotomy">Phlebotomy</Tabs.Tab>}
          {canSamples && <Tabs.Tab value="samples">Sample Mgmt</Tabs.Tab>}
          {canQc && <Tabs.Tab value="qc">QC & Compliance</Tabs.Tab>}
          {canSpecialized && <Tabs.Tab value="specialized">Specialized</Tabs.Tab>}
          {canB2b && <Tabs.Tab value="b2b">B2B</Tabs.Tab>}
          {canOutsourced && <Tabs.Tab value="outsourced">Outsourced</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="orders">
          <OrderStatusPipeline
            orders={data?.orders ?? []}
            activeStatus={filterStatus}
            onStatusClick={(status) => setFilterStatus(filterStatus === status ? null : status)}
          />
          <Group mb="md">
            <Select
              placeholder="Status"
              data={[
                { value: "ordered", label: "Ordered" },
                { value: "sample_collected", label: "Sample Collected" },
                { value: "processing", label: "Processing" },
                { value: "completed", label: "Completed" },
                { value: "verified", label: "Verified" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              clearable
              w={180}
            />
            <Select
              placeholder="Priority"
              data={[
                { value: "routine", label: "Routine" },
                { value: "urgent", label: "Urgent" },
                { value: "stat", label: "STAT" },
              ]}
              value={filterPriority}
              onChange={setFilterPriority}
              clearable
              w={140}
            />
          </Group>
          <DataTable
            columns={columns}
            data={data?.orders ?? []}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            rowKey={(row) => row.id}
          />
        </Tabs.Panel>

        <Tabs.Panel value="catalog">
          <LabCatalogTab canCreate={canCreateOrder} />
        </Tabs.Panel>

        <Tabs.Panel value="panels">
          <LabPanelsTab canCreate={canCreateOrder} />
        </Tabs.Panel>

        {canPhlebotomy && (
          <Tabs.Panel value="phlebotomy">
            <PhlebotomyTab />
          </Tabs.Panel>
        )}

        {canSamples && (
          <Tabs.Panel value="samples">
            <SampleManagementTab />
          </Tabs.Panel>
        )}

        {canQc && (
          <Tabs.Panel value="qc">
            <QcComplianceTab />
          </Tabs.Panel>
        )}

        {canSpecialized && (
          <Tabs.Panel value="specialized">
            <SpecializedReportsTab />
          </Tabs.Panel>
        )}

        {canB2b && (
          <Tabs.Panel value="b2b">
            <B2bTab />
          </Tabs.Panel>
        )}

        {canOutsourced && (
          <Tabs.Panel value="outsourced">
            <OutsourcedTab />
          </Tabs.Panel>
        )}
      </Tabs>

      <CreateLabOrderDrawer opened={createOpened} onClose={closeCreate} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Lab Order Detail" position="right" size="lg">
        {selectedOrderId && (
          <LabOrderDetail orderId={selectedOrderId} canCreateResult={canCreateResult} canVerify={canVerify} canAmend={canAmend} />
        )}
      </Drawer>
    </div>
  );
}

const PIPELINE_STATUSES = [
  { value: "ordered", label: "Ordered" },
  { value: "sample_collected", label: "Sample Collected" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "verified", label: "Verified" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function OrderStatusPipeline({
  orders,
  activeStatus,
  onStatusClick,
}: {
  orders: LabOrder[];
  activeStatus: string | null;
  onStatusClick: (status: string) => void;
}) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of PIPELINE_STATUSES) map[s.value] = 0;
    for (const o of orders) {
      const current = map[o.status];
      if (current !== undefined) map[o.status] = current + 1;
    }
    return map;
  }, [orders]);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="md">
      {PIPELINE_STATUSES.map((s) => (
        <Card
          key={s.value}
          withBorder
          padding="sm"
          style={{
            cursor: "pointer",
            borderLeft: `4px solid var(--mantine-color-${statusColors[s.value]}-6)`,
            opacity: activeStatus && activeStatus !== s.value ? 0.5 : 1,
          }}
          onClick={() => onStatusClick(s.value)}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{s.label}</Text>
          <Text size="xl" fw={700}>{counts[s.value]}</Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function CreateLabOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [priority, setPriority] = useState<string>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateLabOrderRequest) => api.createLabOrder(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({ title: "Order created", message: "Lab order placed", color: "success" });
      emit("lab.order_created", { patient_id: variables.patient_id, test_id: variables.test_id, priority: variables.priority });
      onClose();
      setPatientId("");
      setTestId("");
      setEncounterId("");
      setPriority("routine");
      setClinicalNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create order", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New Lab Order" position="right" size="md">
      <Stack>
        <TextInput label="Patient ID" required value={patientId} onChange={(e) => setPatientId(e.currentTarget.value)} />
        <TextInput label="Test ID" required value={testId} onChange={(e) => setTestId(e.currentTarget.value)} />
        <TextInput label="Encounter ID" value={encounterId} onChange={(e) => setEncounterId(e.currentTarget.value)} />
        <Select
          label="Priority"
          data={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
            { value: "stat", label: "STAT" },
          ]}
          value={priority}
          onChange={(v) => setPriority(v ?? "routine")}
        />
        <TextInput label="Clinical Notes" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.currentTarget.value)} />
        <Button
          onClick={() =>
            createMutation.mutate({
              patient_id: patientId,
              test_id: testId,
              encounter_id: encounterId || undefined,
              priority: priority as LabPriority,
              notes: clinicalNotes || undefined,
            })
          }
          loading={createMutation.isPending}
        >
          Place Order
        </Button>
      </Stack>
    </Drawer>
  );
}

function LabOrderDetail({ orderId, canCreateResult, canVerify, canAmend }: {
  orderId: string;
  canCreateResult: boolean;
  canVerify: boolean;
  canAmend: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [showResultForm, setShowResultForm] = useState(false);
  const [resultInputs, setResultInputs] = useState<ResultInput[]>([{ parameter_name: "", value: "" }]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amendData, setAmendData] = useState<{ resultId: string; value: string; reason: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["lab-order-detail", orderId],
    queryFn: () => api.getLabOrder(orderId),
  });

  // Critical alerts for this order
  const { data: alerts = [] } = useQuery({
    queryKey: ["lab-critical-alerts"],
    queryFn: () => api.listCriticalAlerts(),
  });

  const orderAlerts = alerts.filter((a: LabCriticalAlert) => a.order_id === orderId && !a.acknowledged_at);

  const collectMutation = useMutation({
    mutationFn: () => api.collectSample(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.sample_collected", { order_id: orderId });
    },
  });
  const processMutation = useMutation({
    mutationFn: () => api.startProcessing(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
  });
  const completeMutation = useMutation({
    mutationFn: () => api.completeLabOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.completed", { order_id: orderId });
    },
  });
  const verifyMutation = useMutation({
    mutationFn: () => api.verifyResults(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.results_verified", { order_id: orderId });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => api.cancelLabOrder(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.rejectSample(orderId, { rejection_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setRejectionReason("");
    },
  });
  const addResultsMutation = useMutation({
    mutationFn: () => api.addLabResults(orderId, { results: resultInputs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      emit("lab.results_entered", { order_id: orderId, result_count: resultInputs.length });
      setShowResultForm(false);
      setResultInputs([{ parameter_name: "", value: "" }]);
    },
  });

  // Report status mutations
  const reportStatusMutation = useMutation({
    mutationFn: (status: string) => api.updateLabReportStatus(orderId, { report_status: status as "preliminary" | "final" | "amended" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
  });
  const lockReportMutation = useMutation({
    mutationFn: () => api.lockLabReport(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
  });
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeCriticalAlert(alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] }),
  });
  const amendMutation = useMutation({
    mutationFn: (data: AmendResultRequest) => api.amendLabResult(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      setAmendData(null);
    },
  });
  const addOnMutation = useMutation({
    mutationFn: (testId: string) => api.addOnLabTest(orderId, { test_id: testId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({ title: "Add-on test created", message: "Linked order created", color: "success" });
    },
  });

  const autoValidateMutation = useMutation({
    mutationFn: (resultId: string) => api.autoValidateResult(resultId),
    onSuccess: (result: AutoValidateResult) => {
      queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({
        title: result.auto_validated ? "Auto-validated" : "Validation skipped",
        message: result.message,
        color: result.auto_validated ? "success" : "warning",
      });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Auto-validation failed", color: "danger" });
    },
  });

  // Crossmatch link
  const { data: crossmatchData } = useQuery({
    queryKey: ["lab-order-crossmatch", orderId],
    queryFn: () => api.getOrderCrossmatch(orderId),
    enabled: !!orderId,
    retry: false,
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as LabOrderDetailResponse;
  const order = detail.order;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Order: {order.id.slice(0, 8)}...</Text>
        <Badge color={statusColors[order.status] ?? "slate"} variant="light" size="lg">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </Group>
      <Group>
        <Badge color={priorityColors[order.priority] ?? "slate"} variant="dot">
          Priority: {order.priority}
        </Badge>
        {order.report_status && (
          <Badge color={order.is_report_locked ? "danger" : "primary"} variant="light" size="sm">
            Report: {order.report_status}{order.is_report_locked ? " (locked)" : ""}
          </Badge>
        )}
        {order.is_outsourced && (
          <Badge color="violet" variant="light" size="sm">Outsourced</Badge>
        )}
        {order.parent_order_id && (
          <Badge color="primary" variant="light" size="sm">Add-on</Badge>
        )}
        {crossmatchData && crossmatchData.crossmatch_requests.length > 0 && (
          <Badge color="danger" variant="light" size="sm" leftSection={<IconDroplet size={12} />}>
            Crossmatch ({crossmatchData.crossmatch_requests.length})
          </Badge>
        )}
      </Group>

      {/* Critical alerts banner */}
      {orderAlerts.length > 0 && (
        <Alert color="danger" icon={<IconAlertTriangle size={16} />} title="Critical Values">
          {orderAlerts.map((a: LabCriticalAlert) => (
            <Group key={a.id} justify="space-between" mb={4}>
              <Text size="sm" fw={500}>{a.parameter_name}: {a.value} ({a.flag.replace(/_/g, " ")})</Text>
              <Button size="xs" color="danger" variant="light" onClick={() => acknowledgeMutation.mutate(a.id)}>
                Acknowledge
              </Button>
            </Group>
          ))}
        </Alert>
      )}

      {order.rejection_reason && (
        <Badge color="danger" variant="light" size="lg">Rejected: {order.rejection_reason}</Badge>
      )}

      {/* Status transition buttons */}
      {canCreateResult && (
        <Group>
          {order.status === "ordered" && (
            <Button size="xs" onClick={() => collectMutation.mutate()}>Collect Sample</Button>
          )}
          {order.status === "sample_collected" && (
            <Button size="xs" onClick={() => processMutation.mutate()}>Start Processing</Button>
          )}
          {order.status === "processing" && (
            <Button size="xs" color="orange" onClick={() => completeMutation.mutate()}>Complete</Button>
          )}
          {order.status === "ordered" && (
            <Button size="xs" color="danger" variant="light" onClick={() => cancelMutation.mutate()}>Cancel</Button>
          )}
          {(order.status === "ordered" || order.status === "sample_collected") && (
            <Group gap="xs">
              <TextInput size="xs" placeholder="Rejection reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.currentTarget.value)} w={200} />
              <Button size="xs" color="danger" disabled={!rejectionReason} onClick={() => rejectMutation.mutate(rejectionReason)} loading={rejectMutation.isPending}>
                Reject Sample
              </Button>
            </Group>
          )}
        </Group>
      )}
      {canVerify && order.status === "completed" && (
        <Button size="xs" color="success" onClick={() => verifyMutation.mutate()}>Verify Results</Button>
      )}

      {/* Report status controls */}
      {canVerify && (order.status === "completed" || order.status === "verified") && !order.is_report_locked && (
        <Group>
          <Button size="xs" variant="light" onClick={() => reportStatusMutation.mutate("preliminary")}>Set Preliminary</Button>
          <Button size="xs" variant="light" color="success" onClick={() => reportStatusMutation.mutate("final")}>Set Final</Button>
          <Button size="xs" variant="light" color="danger" leftSection={<IconLock size={14} />} onClick={() => lockReportMutation.mutate()}>Lock Report</Button>
        </Group>
      )}

      <Text fw={600} mt="md">Results</Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Parameter</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th>Unit</Table.Th>
            <Table.Th>Range</Table.Th>
            <Table.Th>Flag</Table.Th>
            <Table.Th>Delta</Table.Th>
            {canVerify && !order.is_report_locked && <Table.Th>Auto-Validate</Table.Th>}
            {canAmend && !order.is_report_locked && <Table.Th>Amend</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.results.map((r: LabResult) => (
            <Table.Tr key={r.id}>
              <Table.Td>{r.parameter_name}</Table.Td>
              <Table.Td fw={500}>{r.value}</Table.Td>
              <Table.Td>{r.unit ?? "—"}</Table.Td>
              <Table.Td>{r.normal_range ?? "—"}</Table.Td>
              <Table.Td>
                {r.flag ? (
                  <Badge color={flagColors[r.flag] ?? "slate"} variant="light" size="sm">
                    {r.flag.replace(/_/g, " ")}
                  </Badge>
                ) : "—"}
              </Table.Td>
              <Table.Td>
                {r.is_delta_flagged ? (
                  <Badge color="danger" variant="light" size="sm">
                    Δ {r.delta_percent ? `${Number(r.delta_percent).toFixed(1)}%` : "flagged"}
                  </Badge>
                ) : r.delta_percent ? (
                  <Text size="xs" c="dimmed">{Number(r.delta_percent).toFixed(1)}%</Text>
                ) : "—"}
              </Table.Td>
              {canVerify && !order.is_report_locked && (
                <Table.Td>
                  {(order.status === "completed" || order.status === "processing") && (
                    <Tooltip label="Auto-Validate Result">
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="teal"
                        loading={autoValidateMutation.isPending}
                        onClick={() => autoValidateMutation.mutate(r.id)}
                      >
                        <IconRobot size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              )}
              {canAmend && !order.is_report_locked && (
                <Table.Td>
                  <ActionIcon size="xs" variant="subtle" onClick={() => setAmendData({ resultId: r.id, value: r.value, reason: "" })}>
                    <IconRefresh size={12} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Amendment form */}
      {amendData && (
        <Stack gap="xs" p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Text size="sm" fw={600}>Amend Result</Text>
          <TextInput size="xs" label="New Value" value={amendData.value} onChange={(e) => setAmendData({ ...amendData, value: e.currentTarget.value })} />
          <TextInput size="xs" label="Reason (required)" value={amendData.reason} onChange={(e) => setAmendData({ ...amendData, reason: e.currentTarget.value })} />
          <Group>
            <Button size="xs" disabled={!amendData.reason} onClick={() => amendMutation.mutate({ result_id: amendData.resultId, amended_value: amendData.value, reason: amendData.reason })} loading={amendMutation.isPending}>
              Save Amendment
            </Button>
            <Button size="xs" variant="light" color="slate" onClick={() => setAmendData(null)}>Cancel</Button>
          </Group>
        </Stack>
      )}

      {/* Add results form */}
      {canCreateResult && (order.status === "processing" || order.status === "sample_collected") && (
        <>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setShowResultForm(!showResultForm)}>
            Add Results
          </Button>
          {showResultForm && (
            <Stack gap="xs">
              {resultInputs.map((ri, idx) => (
                <Group key={idx} grow>
                  <TextInput placeholder="Parameter" value={ri.parameter_name} onChange={(e) => {
                    const updated = [...resultInputs];
                    updated[idx] = { ...ri, parameter_name: e.currentTarget.value };
                    setResultInputs(updated);
                  }} />
                  <TextInput placeholder="Value" value={ri.value} onChange={(e) => {
                    const updated = [...resultInputs];
                    updated[idx] = { ...ri, value: e.currentTarget.value };
                    setResultInputs(updated);
                  }} />
                  <TextInput placeholder="Unit" onChange={(e) => {
                    const updated = [...resultInputs];
                    updated[idx] = { ...ri, unit: e.currentTarget.value || undefined };
                    setResultInputs(updated);
                  }} />
                  <Select placeholder="Flag" data={["normal", "low", "high", "critical_low", "critical_high", "abnormal"]} clearable onChange={(v) => {
                    const updated = [...resultInputs];
                    updated[idx] = { ...ri, flag: (v as LabResultFlag) || undefined };
                    setResultInputs(updated);
                  }} />
                </Group>
              ))}
              <Group>
                <Button size="xs" variant="light" onClick={() => setResultInputs([...resultInputs, { parameter_name: "", value: "" }])}>
                  Add Row
                </Button>
                <Button size="xs" onClick={() => addResultsMutation.mutate()} loading={addResultsMutation.isPending}>
                  Save Results
                </Button>
              </Group>
            </Stack>
          )}
        </>
      )}

      {/* Add-on test */}
      {canCreateResult && order.status !== "cancelled" && (
        <AddOnTestSection onAddOn={(testId) => addOnMutation.mutate(testId)} isPending={addOnMutation.isPending} />
      )}
    </Stack>
  );
}

function AddOnTestSection({ onAddOn, isPending }: { onAddOn: (testId: string) => void; isPending: boolean }) {
  const [testId, setTestId] = useState("");
  return (
    <Group mt="sm">
      <TextInput size="xs" placeholder="Test ID for add-on" value={testId} onChange={(e) => setTestId(e.currentTarget.value)} w={250} />
      <Button size="xs" variant="light" color="primary" disabled={!testId} loading={isPending} onClick={() => { onAddOn(testId); setTestId(""); }}>
        Add-on Test
      </Button>
    </Group>
  );
}

// ══════════════════════════════════════════════════════════
//  Test Catalog Tab (enhanced with Phase 2 fields)
// ══════════════════════════════════════════════════════════

function LabCatalogTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateLabCatalogRequest>>({});

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => api.listLabCatalog(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLabCatalogRequest) => api.createLabCatalogEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-catalog"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (row: LabTestCatalog) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: LabTestCatalog) => <Text size="sm">{row.name}</Text> },
    { key: "sample_type", label: "Sample", render: (row: LabTestCatalog) => <Text size="sm">{row.sample_type ?? "—"}</Text> },
    { key: "loinc_code", label: "LOINC", render: (row: LabTestCatalog) => <Text size="sm">{row.loinc_code ?? "—"}</Text> },
    { key: "price", label: "Price", render: (row: LabTestCatalog) => <Text size="sm">₹{row.price}</Text> },
    { key: "tat_hours", label: "TAT", render: (row: LabTestCatalog) => <Text size="sm">{row.tat_hours ? `${row.tat_hours}h` : "—"}</Text> },
    {
      key: "critical", label: "Critical Range", render: (row: LabTestCatalog) => (
        <Text size="sm">
          {row.critical_low || row.critical_high ? `${row.critical_low ?? "—"} – ${row.critical_high ?? "—"}` : "—"}
        </Text>
      ),
    },
    { key: "is_active", label: "Active", render: (row: LabTestCatalog) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Test
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <Select label="Sample Type" data={SAMPLE_TYPES} onChange={(v) => setForm({ ...form, sample_type: v || undefined })} clearable searchable />
            <TextInput label="Normal Range" placeholder="e.g. 70-100" onChange={(e) => setForm({ ...form, normal_range: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <TextInput label="Unit" placeholder="e.g. mg/dL" onChange={(e) => setForm({ ...form, unit: e.currentTarget.value || undefined })} />
            <NumberInput label="Price" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, price: Number(v) })} />
            <NumberInput label="TAT (hours)" min={0} onChange={(v) => setForm({ ...form, tat_hours: Number(v) || undefined })} />
          </Group>
          <Group grow>
            <TextInput label="LOINC Code" placeholder="e.g. 2345-7" onChange={(e) => setForm({ ...form, loinc_code: e.currentTarget.value || undefined })} />
            <Select label="Method" data={LAB_METHODS} onChange={(v) => setForm({ ...form, method: v || undefined })} clearable searchable />
            <TextInput label="Specimen Volume" placeholder="e.g. 5 mL" onChange={(e) => setForm({ ...form, specimen_volume: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Critical Low" decimalScale={4} onChange={(v) => setForm({ ...form, critical_low: Number(v) || undefined })} />
            <NumberInput label="Critical High" decimalScale={4} onChange={(v) => setForm({ ...form, critical_high: Number(v) || undefined })} />
            <NumberInput label="Delta Check %" min={0} max={100} onChange={(v) => setForm({ ...form, delta_check_percent: Number(v) || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateLabCatalogRequest)} loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={catalog} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Panels Tab (unchanged from Phase 1)
// ══════════════════════════════════════════════════════════

function LabPanelsTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateLabPanelRequest>>({ test_ids: [] });
  const [testIdInput, setTestIdInput] = useState("");

  const { data: panels = [], isLoading } = useQuery({
    queryKey: ["lab-panels"],
    queryFn: () => api.listLabPanels(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLabPanelRequest) => api.createLabPanel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-panels"] });
      setShowForm(false);
      setForm({ test_ids: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLabPanel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-panels"] }),
  });

  const addTestId = () => {
    if (testIdInput.trim()) {
      setForm({ ...form, test_ids: [...(form.test_ids ?? []), testIdInput.trim()] });
      setTestIdInput("");
    }
  };

  const columns = [
    { key: "code", label: "Code", render: (row: LabTestPanel) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: LabTestPanel) => <Text size="sm">{row.name}</Text> },
    { key: "description", label: "Description", render: (row: LabTestPanel) => <Text size="sm">{row.description ?? "—"}</Text> },
    { key: "price", label: "Price", render: (row: LabTestPanel) => <Text size="sm">₹{row.price}</Text> },
    { key: "is_active", label: "Active", render: (row: LabTestPanel) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
    {
      key: "actions", label: "Actions", render: (row: LabTestPanel) => (
        <ActionIcon color="danger" variant="subtle" onClick={() => deleteMutation.mutate(row.id)}>
          <IconX size={14} />
        </ActionIcon>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Panel
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required placeholder="e.g. CBC" onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required placeholder="e.g. Complete Blood Count" onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Description" onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })} />
            <NumberInput label="Panel Price" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, price: Number(v) })} />
          </Group>
          <Group>
            <TextInput label="Add Test ID" value={testIdInput} onChange={(e) => setTestIdInput(e.currentTarget.value)} w={300} />
            <Button size="xs" variant="light" mt={24} onClick={addTestId}>Add</Button>
          </Group>
          {(form.test_ids ?? []).length > 0 && (
            <Group gap="xs">
              {(form.test_ids ?? []).map((tid, i) => (
                <Badge key={i} variant="light" rightSection={
                  <ActionIcon size="xs" variant="transparent" onClick={() => setForm({ ...form, test_ids: (form.test_ids ?? []).filter((_, j) => j !== i) })}>
                    <IconX size={10} />
                  </ActionIcon>
                }>
                  {tid.slice(0, 8)}...
                </Badge>
              ))}
            </Group>
          )}
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateLabPanelRequest)} loading={createMutation.isPending}>
            Save Panel
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={panels} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phlebotomy Tab (NEW)
// ══════════════════════════════════════════════════════════

function PhlebotomyTab() {
  const canManage = useHasPermission(P.LAB.PHLEBOTOMY_MANAGE);
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["lab-phlebotomy-queue"],
    queryFn: () => api.listPhlebotomyQueue(),
    refetchInterval: 15_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updatePhlebotomyStatus(id, { status: status as "in_progress" | "completed" | "skipped" | "waiting" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-phlebotomy-queue"] }),
  });

  const columns = [
    { key: "patient_id", label: "Patient", render: (row: LabPhlebotomyQueueItem) => <Text size="sm">{row.patient_id.slice(0, 8)}...</Text> },
    { key: "order_id", label: "Order", render: (row: LabPhlebotomyQueueItem) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text> },
    {
      key: "priority", label: "Priority", render: (row: LabPhlebotomyQueueItem) => (
        <StatusDot color={priorityColors[row.priority] ?? "slate"} label={row.priority} />
      ),
    },
    {
      key: "status", label: "Status", render: (row: LabPhlebotomyQueueItem) => (
        <Badge color={phlebotomyStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "queued_at", label: "Queued", render: (row: LabPhlebotomyQueueItem) => <Text size="sm">{new Date(row.queued_at).toLocaleTimeString()}</Text> },
    {
      key: "actions", label: "Actions", render: (row: LabPhlebotomyQueueItem) => canManage ? (
        <Group gap="xs">
          {row.status === "waiting" && (
            <Button size="xs" variant="light" onClick={() => statusMutation.mutate({ id: row.id, status: "in_progress" })}>
              Start
            </Button>
          )}
          {row.status === "in_progress" && (
            <Button size="xs" variant="light" color="success" onClick={() => statusMutation.mutate({ id: row.id, status: "completed" })}>
              Complete
            </Button>
          )}
          {(row.status === "waiting" || row.status === "in_progress") && (
            <Button size="xs" variant="light" color="slate" onClick={() => statusMutation.mutate({ id: row.id, status: "skipped" })}>
              Skip
            </Button>
          )}
        </Group>
      ) : <Text size="sm" c="dimmed">—</Text>,
    },
  ];

  return (
    <Stack>
      <Text fw={600}>Phlebotomy Collection Queue</Text>
      <DataTable columns={columns} data={queue} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  QC & Compliance Tab (NEW)
// ══════════════════════════════════════════════════════════

function QcComplianceTab() {
  const [subTab, setSubTab] = useState("reagent-lots");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "reagent-lots")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="reagent-lots">Reagent Lots</Tabs.Tab>
          <Tabs.Tab value="qc-results">QC Results</Tabs.Tab>
          <Tabs.Tab value="calibrations">Calibrations</Tabs.Tab>
          <Tabs.Tab value="eqas">EQAS</Tabs.Tab>
          <Tabs.Tab value="proficiency">Proficiency Testing</Tabs.Tab>
          <Tabs.Tab value="nabl">NABL Documents</Tabs.Tab>
          <Tabs.Tab value="consumption">Reagent Consumption</Tabs.Tab>
          <Tabs.Tab value="tat-analytics" leftSection={<IconClock size={14} />}>TAT Analytics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reagent-lots"><ReagentLotsSection /></Tabs.Panel>
        <Tabs.Panel value="qc-results"><QcResultsSection /></Tabs.Panel>
        <Tabs.Panel value="calibrations"><CalibrationsSection /></Tabs.Panel>
        <Tabs.Panel value="eqas"><EqasSection /></Tabs.Panel>
        <Tabs.Panel value="proficiency"><ProficiencyTestingSection /></Tabs.Panel>
        <Tabs.Panel value="nabl"><NablDocumentsSection /></Tabs.Panel>
        <Tabs.Panel value="consumption"><ReagentConsumptionSection /></Tabs.Panel>
        <Tabs.Panel value="tat-analytics"><TatAnalyticsSection /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ReagentLotsSection() {
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateReagentLotRequest>>({});

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ["lab-reagent-lots"],
    queryFn: () => api.listReagentLots(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateReagentLotRequest) => api.createReagentLot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-reagent-lots"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "reagent_name", label: "Reagent", render: (row: LabReagentLot) => <Text fw={500}>{row.reagent_name}</Text> },
    { key: "lot_number", label: "Lot #", render: (row: LabReagentLot) => <Text size="sm">{row.lot_number}</Text> },
    { key: "manufacturer", label: "Manufacturer", render: (row: LabReagentLot) => <Text size="sm">{row.manufacturer ?? "—"}</Text> },
    {
      key: "expiry_date", label: "Expiry", render: (row: LabReagentLot) => {
        if (!row.expiry_date) return <Text size="sm">—</Text>;
        const isExpired = new Date(row.expiry_date) < new Date();
        return <Badge color={isExpired ? "danger" : "success"} variant="light" size="sm">{row.expiry_date}</Badge>;
      },
    },
    { key: "quantity", label: "Qty", render: (row: LabReagentLot) => <Text size="sm">{row.quantity ? `${row.quantity} ${row.quantity_unit ?? ""}` : "—"}</Text> },
    { key: "is_active", label: "Active", render: (row: LabReagentLot) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Reagent Lot</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Reagent Name" required onChange={(e) => setForm({ ...form, reagent_name: e.currentTarget.value })} />
            <TextInput label="Lot Number" required onChange={(e) => setForm({ ...form, lot_number: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Manufacturer" onChange={(e) => setForm({ ...form, manufacturer: e.currentTarget.value || undefined })} />
            <TextInput label="Test ID" onChange={(e) => setForm({ ...form, test_id: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <TextInput label="Expiry Date" type="date" onChange={(e) => setForm({ ...form, expiry_date: e.currentTarget.value || undefined })} />
            <NumberInput label="Quantity" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, quantity: Number(v) || undefined })} />
            <TextInput label="Unit" onChange={(e) => setForm({ ...form, quantity_unit: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateReagentLotRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={lots} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function QcResultsSection() {
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateQcResultRequest>>({});
  const [chartLotId, setChartLotId] = useState<string | null>(null);

  const { data: qcResults = [], isLoading } = useQuery({
    queryKey: ["lab-qc-results"],
    queryFn: () => api.listQcResults(),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["lab-reagent-lots"],
    queryFn: () => api.listReagentLots(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateQcResultRequest) => api.createQcResult(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-qc-results"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "test_id", label: "Test", render: (row: LabQcResult) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text> },
    { key: "level", label: "Level", render: (row: LabQcResult) => <Text size="sm">{row.level}</Text> },
    { key: "observed_value", label: "Observed", render: (row: LabQcResult) => <Text size="sm">{row.observed_value ?? "—"}</Text> },
    { key: "sd_index", label: "SD Index", render: (row: LabQcResult) => <Text size="sm" fw={row.sd_index && Math.abs(Number(row.sd_index)) > 2 ? 700 : 400}>{row.sd_index ?? "—"}</Text> },
    {
      key: "status", label: "Status", render: (row: LabQcResult) => (
        <Badge color={qcStatusColors[row.status] ?? "slate"} variant="light" size="sm">{row.status}</Badge>
      ),
    },
    {
      key: "westgard", label: "Westgard", render: (row: LabQcResult) => (
        row.westgard_violations?.length ? (
          <Badge color="danger" variant="light" size="sm">{row.westgard_violations.join(", ")}</Badge>
        ) : <Text size="sm" c="dimmed">OK</Text>
      ),
    },
    { key: "run_date", label: "Run Date", render: (row: LabQcResult) => <Text size="sm">{row.run_date ?? "—"}</Text> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add QC Result</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Test ID" required onChange={(e) => setForm({ ...form, test_id: e.currentTarget.value })} />
            <TextInput label="Lot ID" required onChange={(e) => setForm({ ...form, lot_id: e.currentTarget.value })} />
            <TextInput label="Level" required placeholder="e.g. L1, L2" onChange={(e) => setForm({ ...form, level: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <NumberInput label="Target Mean" decimalScale={4} onChange={(v) => setForm({ ...form, target_mean: Number(v) || undefined })} />
            <NumberInput label="Target SD" decimalScale={4} onChange={(v) => setForm({ ...form, target_sd: Number(v) || undefined })} />
            <NumberInput label="Observed Value" decimalScale={4} onChange={(v) => setForm({ ...form, observed_value: Number(v) || undefined })} />
          </Group>
          <TextInput label="Run Date" type="date" onChange={(e) => setForm({ ...form, run_date: e.currentTarget.value || undefined })} w={200} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateQcResultRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={qcResults} loading={isLoading} rowKey={(row) => row.id} />

      {/* Levey-Jennings Chart */}
      <LeveyJenningsChart
        qcResults={qcResults}
        lots={lots}
        selectedLotId={chartLotId}
        onLotChange={setChartLotId}
      />
    </Stack>
  );
}

function LeveyJenningsChart({
  qcResults,
  lots,
  selectedLotId,
  onLotChange,
}: {
  qcResults: LabQcResult[];
  lots: LabReagentLot[];
  selectedLotId: string | null;
  onLotChange: (id: string | null) => void;
}) {
  const lotResults = useMemo(() => {
    if (!selectedLotId) return [];
    return qcResults
      .filter((r) => r.lot_id === selectedLotId && r.observed_value != null && r.run_date)
      .sort((a, b) => (a.run_date ?? "").localeCompare(b.run_date ?? ""));
  }, [qcResults, selectedLotId]);

  const { chartData, refLines, hasData, mean, sd } = useMemo(() => {
    if (lotResults.length === 0) {
      return { chartData: [], refLines: [], hasData: false, mean: 0, sd: 0 };
    }

    // Derive mean and SD from the first result that has them; fall back to lot-level average
    const withMean = lotResults.find((r) => r.target_mean != null && r.target_sd != null);
    const targetMean = withMean ? Number(withMean.target_mean) : 0;
    const targetSd = withMean ? Number(withMean.target_sd) : 0;

    if (targetSd === 0) {
      return { chartData: [], refLines: [], hasData: false, mean: targetMean, sd: 0 };
    }

    const points = lotResults.map((r) => {
      const observed = Number(r.observed_value);
      const sdIdx = targetSd !== 0 ? Math.abs((observed - targetMean) / targetSd) : 0;
      let pointColor = "success";
      if (sdIdx > 3) pointColor = "danger";
      else if (sdIdx > 2) pointColor = "orange";
      else if (sdIdx > 1) pointColor = "warning";
      return {
        date: r.run_date ?? "",
        observed,
        color: pointColor,
      };
    });

    const lines = [
      { y: targetMean, color: "blue.6", label: "Mean" },
      { y: targetMean + targetSd, color: "green.5", label: "+1SD" },
      { y: targetMean - targetSd, color: "green.5", label: "-1SD" },
      { y: targetMean + 2 * targetSd, color: "yellow.5", label: "+2SD" },
      { y: targetMean - 2 * targetSd, color: "yellow.5", label: "-2SD" },
      { y: targetMean + 3 * targetSd, color: "red.5", label: "+3SD" },
      { y: targetMean - 3 * targetSd, color: "red.5", label: "-3SD" },
    ];

    return { chartData: points, refLines: lines, hasData: true, mean: targetMean, sd: targetSd };
  }, [lotResults]);

  return (
    <Stack mt="lg" gap="sm">
      <Text fw={600} size="sm">Levey-Jennings QC Chart</Text>
      <Select
        label="Select Reagent Lot"
        placeholder="Choose a lot to view QC chart"
        data={lots.map((l) => ({ value: l.id, label: `${l.reagent_name} — Lot ${l.lot_number}` }))}
        value={selectedLotId}
        onChange={onLotChange}
        clearable
        w={400}
      />
      {selectedLotId && !hasData && (
        <Text size="sm" c="dimmed">
          No QC results with target mean/SD found for this lot. Ensure QC results have target_mean and target_sd values.
        </Text>
      )}
      {selectedLotId && hasData && (
        <Stack gap="xs">
          <Group gap="lg">
            <Badge variant="light" color="primary">Mean: {mean.toFixed(2)}</Badge>
            <Badge variant="light" color="success">SD: {sd.toFixed(2)}</Badge>
            <Badge variant="light" color="slate">{chartData.length} points</Badge>
          </Group>
          <Group gap="xs">
            <Badge size="xs" color="success" variant="dot">Within 1SD</Badge>
            <Badge size="xs" color="warning" variant="dot">1-2 SD</Badge>
            <Badge size="xs" color="orange" variant="dot">2-3 SD</Badge>
            <Badge size="xs" color="danger" variant="dot">Beyond 3SD</Badge>
          </Group>
          <LineChart
            h={350}
            data={chartData}
            dataKey="date"
            series={[{ name: "observed", color: "violet" }]}
            curveType="monotone"
            connectNulls
            withTooltip
            withDots
            referenceLines={refLines}
          />
        </Stack>
      )}
    </Stack>
  );
}

function CalibrationsSection() {
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateCalibrationRequest>>({});

  const { data: calibrations = [], isLoading } = useQuery({
    queryKey: ["lab-calibrations"],
    queryFn: () => api.listCalibrations(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCalibrationRequest) => api.createCalibration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-calibrations"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "test_id", label: "Test", render: (row: LabCalibration) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text> },
    { key: "instrument_name", label: "Instrument", render: (row: LabCalibration) => <Text size="sm">{row.instrument_name ?? "—"}</Text> },
    { key: "calibrator_lot", label: "Calibrator Lot", render: (row: LabCalibration) => <Text size="sm">{row.calibrator_lot ?? "—"}</Text> },
    { key: "calibration_date", label: "Date", render: (row: LabCalibration) => <Text size="sm">{row.calibration_date ?? "—"}</Text> },
    { key: "next_calibration_date", label: "Next", render: (row: LabCalibration) => <Text size="sm">{row.next_calibration_date ?? "—"}</Text> },
    { key: "is_passed", label: "Passed", render: (row: LabCalibration) => row.is_passed ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Calibration</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Test ID" required onChange={(e) => setForm({ ...form, test_id: e.currentTarget.value })} />
            <TextInput label="Instrument" onChange={(e) => setForm({ ...form, instrument_name: e.currentTarget.value || undefined })} />
            <TextInput label="Calibrator Lot" onChange={(e) => setForm({ ...form, calibrator_lot: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <TextInput label="Date" type="date" onChange={(e) => setForm({ ...form, calibration_date: e.currentTarget.value || undefined })} />
            <TextInput label="Next Calibration" type="date" onChange={(e) => setForm({ ...form, next_calibration_date: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateCalibrationRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={calibrations} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Outsourced Tab (NEW)
// ══════════════════════════════════════════════════════════

function OutsourcedTab() {
  const canManage = useHasPermission(P.LAB.OUTSOURCED_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateOutsourcedOrderRequest>>({});

  const { data: outsourced = [], isLoading } = useQuery({
    queryKey: ["lab-outsourced"],
    queryFn: () => api.listOutsourcedOrders(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateOutsourcedOrderRequest) => api.createOutsourcedOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] });
      setShowForm(false);
      setForm({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOutsourcedOrder(id, { status: status as "pending_send" | "sent" | "result_received" | "cancelled" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] }),
  });

  const columns = [
    { key: "order_id", label: "Order", render: (row: LabOutsourcedOrder) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text> },
    { key: "external_lab_name", label: "External Lab", render: (row: LabOutsourcedOrder) => <Text fw={500}>{row.external_lab_name}</Text> },
    {
      key: "status", label: "Status", render: (row: LabOutsourcedOrder) => (
        <Badge color={outsourceStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "sent_date", label: "Sent", render: (row: LabOutsourcedOrder) => <Text size="sm">{row.sent_date ?? "—"}</Text> },
    { key: "expected_return_date", label: "Expected", render: (row: LabOutsourcedOrder) => <Text size="sm">{row.expected_return_date ?? "—"}</Text> },
    { key: "cost", label: "Cost", render: (row: LabOutsourcedOrder) => <Text size="sm">{row.cost ? `₹${row.cost}` : "—"}</Text> },
    {
      key: "actions", label: "Actions", render: (row: LabOutsourcedOrder) => canManage ? (
        <Group gap="xs">
          {row.status === "pending_send" && (
            <Button size="xs" variant="light" onClick={() => updateMutation.mutate({ id: row.id, status: "sent" })}>
              Mark Sent
            </Button>
          )}
          {row.status === "sent" && (
            <Button size="xs" variant="light" color="success" onClick={() => updateMutation.mutate({ id: row.id, status: "result_received" })}>
              Result Received
            </Button>
          )}
        </Group>
      ) : <Text size="sm" c="dimmed">—</Text>,
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Outsource Order</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Order ID" required onChange={(e) => setForm({ ...form, order_id: e.currentTarget.value })} />
            <TextInput label="External Lab Name" required onChange={(e) => setForm({ ...form, external_lab_name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Lab Code" onChange={(e) => setForm({ ...form, external_lab_code: e.currentTarget.value || undefined })} />
            <TextInput label="Sent Date" type="date" onChange={(e) => setForm({ ...form, sent_date: e.currentTarget.value || undefined })} />
            <TextInput label="Expected Return" type="date" onChange={(e) => setForm({ ...form, expected_return_date: e.currentTarget.value || undefined })} />
          </Group>
          <NumberInput label="Cost" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, cost: Number(v) || undefined })} w={200} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateOutsourcedOrderRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={outsourced} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Sample Management Tab (Phase 3)
// ══════════════════════════════════════════════════════════

const homeCollectionStatusColors: Record<string, string> = {
  scheduled: "primary",
  assigned: "info",
  in_transit: "orange",
  arrived: "warning",
  collected: "success",
  returned_to_lab: "teal",
  cancelled: "danger",
};

const archiveStatusColors: Record<string, string> = {
  stored: "primary",
  retrieved: "success",
  discarded: "slate",
  expired: "danger",
};

function SampleManagementTab() {
  const [subTab, setSubTab] = useState("home-collections");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "home-collections")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="home-collections">Home Collections</Tabs.Tab>
          <Tabs.Tab value="collection-centers">Collection Centers</Tabs.Tab>
          <Tabs.Tab value="sample-archive">Sample Archive</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home-collections"><HomeCollectionsSection /></Tabs.Panel>
        <Tabs.Panel value="collection-centers"><CollectionCentersSection /></Tabs.Panel>
        <Tabs.Panel value="sample-archive"><SampleArchiveSection /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function HomeCollectionsSection() {
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateHomeCollectionRequest>>({});

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["lab-home-collections"],
    queryFn: () => api.listHomeCollections(),
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["lab-home-collection-stats"],
    queryFn: () => api.getHomeCollectionStats(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHomeCollectionRequest) => api.createHomeCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-home-collections"] });
      queryClient.invalidateQueries({ queryKey: ["lab-home-collection-stats"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "patient_id", label: "Patient", render: (row: LabHomeCollection) => <Text size="sm">{row.patient_id.slice(0, 8)}...</Text> },
    { key: "scheduled_date", label: "Date", render: (row: LabHomeCollection) => <Text size="sm">{row.scheduled_date}</Text> },
    { key: "scheduled_time_slot", label: "Time", render: (row: LabHomeCollection) => <Text size="sm">{row.scheduled_time_slot ?? "—"}</Text> },
    { key: "city", label: "City", render: (row: LabHomeCollection) => <Text size="sm">{row.city ?? "—"}</Text> },
    {
      key: "status", label: "Status", render: (row: LabHomeCollection) => (
        <Badge color={homeCollectionStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "assigned", label: "Phlebotomist", render: (row: LabHomeCollection) => <Text size="sm">{row.assigned_phlebotomist?.slice(0, 8) ?? "Unassigned"}</Text> },
  ];

  return (
    <Stack>
      {stats.length > 0 && (
        <Group gap="md" mb="xs">
          {stats.map((s: HomeCollectionStatsRow) => (
            <Badge key={s.status} color={homeCollectionStatusColors[s.status] ?? "slate"} variant="light">
              {s.status.replace(/_/g, " ")}: {s.count}
            </Badge>
          ))}
        </Group>
      )}
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Schedule Collection</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
            <TextInput label="Scheduled Date" type="date" required onChange={(e) => setForm({ ...form, scheduled_date: e.currentTarget.value })} />
            <TextInput label="Time Slot" placeholder="e.g. 9:00-11:00 AM" onChange={(e) => setForm({ ...form, scheduled_time_slot: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <TextInput label="Address" onChange={(e) => setForm({ ...form, address_line: e.currentTarget.value || undefined })} />
            <TextInput label="City" onChange={(e) => setForm({ ...form, city: e.currentTarget.value || undefined })} />
            <TextInput label="Pincode" onChange={(e) => setForm({ ...form, pincode: e.currentTarget.value || undefined })} />
          </Group>
          <TextInput label="Contact Phone" onChange={(e) => setForm({ ...form, contact_phone: e.currentTarget.value || undefined })} w={200} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateHomeCollectionRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={collections} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function CollectionCentersSection() {
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateCollectionCenterRequest>>({});

  const { data: centers = [], isLoading } = useQuery({
    queryKey: ["lab-collection-centers"],
    queryFn: () => api.listCollectionCenters(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionCenterRequest) => api.createCollectionCenter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-collection-centers"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (row: LabCollectionCenter) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: LabCollectionCenter) => <Text size="sm">{row.name}</Text> },
    { key: "center_type", label: "Type", render: (row: LabCollectionCenter) => <Badge variant="light" size="sm">{row.center_type}</Badge> },
    { key: "city", label: "City", render: (row: LabCollectionCenter) => <Text size="sm">{row.city ?? "—"}</Text> },
    { key: "contact_person", label: "Contact", render: (row: LabCollectionCenter) => <Text size="sm">{row.contact_person ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (row: LabCollectionCenter) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Center</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            <Select label="Type" required data={["hospital", "satellite", "partner", "camp"]} onChange={(v) => setForm({ ...form, center_type: v as CreateCollectionCenterRequest["center_type"] })} />
          </Group>
          <Group grow>
            <TextInput label="City" onChange={(e) => setForm({ ...form, city: e.currentTarget.value || undefined })} />
            <TextInput label="Phone" onChange={(e) => setForm({ ...form, phone: e.currentTarget.value || undefined })} />
            <TextInput label="Contact Person" onChange={(e) => setForm({ ...form, contact_person: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateCollectionCenterRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={centers} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function SampleArchiveSection() {
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateSampleArchiveRequest>>({});

  const { data: archives = [], isLoading } = useQuery({
    queryKey: ["lab-sample-archive"],
    queryFn: () => api.listSampleArchive(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSampleArchiveRequest) => api.createSampleArchive(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-sample-archive"] });
      setShowForm(false);
      setForm({});
    },
  });

  const retrieveMutation = useMutation({
    mutationFn: (id: string) => api.retrieveSampleArchive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-sample-archive"] }),
  });

  const columns = [
    { key: "sample_barcode", label: "Barcode", render: (row: LabSampleArchive) => <Text fw={500}>{row.sample_barcode ?? "—"}</Text> },
    { key: "patient_id", label: "Patient", render: (row: LabSampleArchive) => <Text size="sm">{row.patient_id?.slice(0, 8) ?? "—"}</Text> },
    { key: "storage_location", label: "Location", render: (row: LabSampleArchive) => <Text size="sm">{row.storage_location ?? "—"}</Text> },
    {
      key: "status", label: "Status", render: (row: LabSampleArchive) => (
        <Badge color={archiveStatusColors[row.status] ?? "slate"} variant="light" size="sm">{row.status}</Badge>
      ),
    },
    { key: "stored_at", label: "Stored", render: (row: LabSampleArchive) => <Text size="sm">{row.stored_at ? new Date(row.stored_at).toLocaleDateString() : "—"}</Text> },
    {
      key: "actions", label: "Actions", render: (row: LabSampleArchive) => canManage && row.status === "stored" ? (
        <Button size="xs" variant="light" onClick={() => retrieveMutation.mutate(row.id)}>Retrieve</Button>
      ) : <Text size="sm" c="dimmed">—</Text>,
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Archive Sample</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Sample Barcode" onChange={(e) => setForm({ ...form, sample_barcode: e.currentTarget.value || undefined })} />
            <TextInput label="Patient ID" onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value || undefined })} />
            <TextInput label="Storage Location" onChange={(e) => setForm({ ...form, storage_location: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateSampleArchiveRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={archives} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  QC Phase 3 Sections (EQAS, Proficiency, NABL, Consumption)
// ══════════════════════════════════════════════════════════

const eqasColors: Record<string, string> = {
  acceptable: "success",
  marginal: "warning",
  unacceptable: "danger",
  pending: "slate",
};

function EqasSection() {
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateEqasResultRequest>>({});

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["lab-eqas"],
    queryFn: () => api.listEqasResults(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEqasResultRequest) => api.createEqasResult(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-eqas"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "program_name", label: "Program", render: (row: LabEqasResult) => <Text fw={500}>{row.program_name}</Text> },
    { key: "provider", label: "Provider", render: (row: LabEqasResult) => <Text size="sm">{row.provider ?? "—"}</Text> },
    { key: "cycle", label: "Cycle", render: (row: LabEqasResult) => <Text size="sm">{row.cycle ?? "—"}</Text> },
    { key: "expected_value", label: "Expected", render: (row: LabEqasResult) => <Text size="sm">{row.expected_value ?? "—"}</Text> },
    { key: "reported_value", label: "Reported", render: (row: LabEqasResult) => <Text size="sm">{row.reported_value ?? "—"}</Text> },
    {
      key: "evaluation", label: "Evaluation", render: (row: LabEqasResult) => (
        <Badge color={eqasColors[row.evaluation] ?? "slate"} variant="light" size="sm">{row.evaluation}</Badge>
      ),
    },
    { key: "z_score", label: "Z-Score", render: (row: LabEqasResult) => <Text size="sm">{row.z_score ?? "—"}</Text> },
    { key: "bias_percent", label: "Bias %", render: (row: LabEqasResult) => <Text size="sm">{row.bias_percent != null ? `${row.bias_percent}%` : "—"}</Text> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add EQAS Result</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Program Name" required onChange={(e) => setForm({ ...form, program_name: e.currentTarget.value })} />
            <TextInput label="Provider" onChange={(e) => setForm({ ...form, provider: e.currentTarget.value || undefined })} />
            <TextInput label="Cycle" onChange={(e) => setForm({ ...form, cycle: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Expected Value" decimalScale={4} onChange={(v) => setForm({ ...form, expected_value: Number(v) || undefined })} />
            <NumberInput label="Reported Value" decimalScale={4} onChange={(v) => setForm({ ...form, reported_value: Number(v) || undefined })} />
            <Select label="Evaluation" data={["acceptable", "marginal", "unacceptable", "pending"]} onChange={(v) => setForm({ ...form, evaluation: v as CreateEqasResultRequest["evaluation"] })} />
          </Group>
          <Group grow>
            <NumberInput label="Bias %" decimalScale={2} onChange={(v) => setForm({ ...form, bias_percent: Number(v) || undefined })} />
            <NumberInput label="Z-Score" decimalScale={2} onChange={(v) => setForm({ ...form, z_score: Number(v) || undefined })} />
            <TextInput label="Report Date" type="date" onChange={(e) => setForm({ ...form, report_date: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateEqasResultRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={results} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function ProficiencyTestingSection() {
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateProficiencyTestRequest>>({});

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["lab-proficiency-tests"],
    queryFn: () => api.listProficiencyTests(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProficiencyTestRequest) => api.createProficiencyTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-proficiency-tests"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "program", label: "Program", render: (row: LabProficiencyTest) => <Text fw={500}>{row.program}</Text> },
    { key: "survey_round", label: "Round", render: (row: LabProficiencyTest) => <Text size="sm">{row.survey_round ?? "—"}</Text> },
    { key: "sample_id", label: "Sample", render: (row: LabProficiencyTest) => <Text size="sm">{row.sample_id ?? "—"}</Text> },
    { key: "assigned_value", label: "Assigned", render: (row: LabProficiencyTest) => <Text size="sm">{row.assigned_value ?? "—"}</Text> },
    { key: "reported_value", label: "Reported", render: (row: LabProficiencyTest) => <Text size="sm">{row.reported_value ?? "—"}</Text> },
    { key: "range", label: "Range", render: (row: LabProficiencyTest) => <Text size="sm">{row.acceptable_range_low != null && row.acceptable_range_high != null ? `${row.acceptable_range_low}–${row.acceptable_range_high}` : "—"}</Text> },
    {
      key: "is_acceptable", label: "Result", render: (row: LabProficiencyTest) => row.is_acceptable != null ? (
        <Badge color={row.is_acceptable ? "success" : "danger"} variant="light" size="sm">{row.is_acceptable ? "Pass" : "Fail"}</Badge>
      ) : <Text size="sm" c="dimmed">Pending</Text>,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add PT Result</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Program" required onChange={(e) => setForm({ ...form, program: e.currentTarget.value })} />
            <TextInput label="Survey Round" onChange={(e) => setForm({ ...form, survey_round: e.currentTarget.value || undefined })} />
            <TextInput label="Sample ID" onChange={(e) => setForm({ ...form, sample_id: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Assigned Value" decimalScale={4} onChange={(v) => setForm({ ...form, assigned_value: Number(v) || undefined })} />
            <NumberInput label="Reported Value" decimalScale={4} onChange={(v) => setForm({ ...form, reported_value: Number(v) || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Range Low" decimalScale={4} onChange={(v) => setForm({ ...form, acceptable_range_low: Number(v) || undefined })} />
            <NumberInput label="Range High" decimalScale={4} onChange={(v) => setForm({ ...form, acceptable_range_high: Number(v) || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateProficiencyTestRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={tests} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function NablDocumentsSection() {
  const canManage = useHasPermission(P.LAB.QC_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateNablDocumentRequest>>({});

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["lab-nabl-documents"],
    queryFn: () => api.listNablDocuments(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateNablDocumentRequest) => api.createNablDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-nabl-documents"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "document_number", label: "Doc #", render: (row: LabNablDocument) => <Text fw={500}>{row.document_number}</Text> },
    { key: "title", label: "Title", render: (row: LabNablDocument) => <Text size="sm">{row.title}</Text> },
    { key: "document_type", label: "Type", render: (row: LabNablDocument) => <Text size="sm">{row.document_type ?? "—"}</Text> },
    { key: "version", label: "Version", render: (row: LabNablDocument) => <Badge variant="light" size="sm">{row.version ?? "—"}</Badge> },
    { key: "effective_date", label: "Effective", render: (row: LabNablDocument) => <Text size="sm">{row.effective_date ?? "—"}</Text> },
    { key: "review_date", label: "Review", render: (row: LabNablDocument) => <Text size="sm">{row.review_date ?? "—"}</Text> },
    { key: "is_current", label: "Current", render: (row: LabNablDocument) => row.is_current ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Document</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Document Number" required onChange={(e) => setForm({ ...form, document_number: e.currentTarget.value })} />
            <TextInput label="Title" required onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
            <Select label="Type" data={DOCUMENT_TYPES} placeholder="Select type" onChange={(v) => setForm({ ...form, document_type: v || undefined })} clearable />
          </Group>
          <Group grow>
            <TextInput label="Version" onChange={(e) => setForm({ ...form, version: e.currentTarget.value || undefined })} />
            <TextInput label="Effective Date" type="date" onChange={(e) => setForm({ ...form, effective_date: e.currentTarget.value || undefined })} />
            <TextInput label="Review Date" type="date" onChange={(e) => setForm({ ...form, review_date: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateNablDocumentRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={docs} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function ReagentConsumptionSection() {
  const { data: consumption = [], isLoading } = useQuery({
    queryKey: ["lab-reagent-consumption"],
    queryFn: () => api.getReagentConsumption(),
  });

  const columns = [
    { key: "reagent_name", label: "Reagent", render: (row: ReagentConsumptionRow) => <Text fw={500}>{row.reagent_name}</Text> },
    { key: "lot_number", label: "Lot #", render: (row: ReagentConsumptionRow) => <Text size="sm">{row.lot_number}</Text> },
    { key: "quantity", label: "Qty", render: (row: ReagentConsumptionRow) => <Text size="sm">{row.quantity != null ? `${row.quantity} ${row.quantity_unit ?? ""}` : "—"}</Text> },
    { key: "reorder_level", label: "Reorder", render: (row: ReagentConsumptionRow) => <Text size="sm">{row.reorder_level ?? "—"}</Text> },
    { key: "consumption_per_test", label: "Per Test", render: (row: ReagentConsumptionRow) => <Text size="sm">{row.consumption_per_test ?? "—"}</Text> },
    {
      key: "below_reorder", label: "Status", render: (row: ReagentConsumptionRow) => {
        if (row.reorder_level == null || row.quantity == null) return <Text size="sm" c="dimmed">—</Text>;
        return row.quantity <= row.reorder_level
          ? <Badge color="danger" variant="light" size="sm">Below Reorder</Badge>
          : <Badge color="success" variant="light" size="sm">OK</Badge>;
      },
    },
    {
      key: "expiry_date", label: "Expiry", render: (row: ReagentConsumptionRow) => {
        if (!row.expiry_date) return <Text size="sm">—</Text>;
        const isExpired = new Date(row.expiry_date) < new Date();
        return <Badge color={isExpired ? "danger" : "success"} variant="light" size="sm">{row.expiry_date}</Badge>;
      },
    },
  ];

  return (
    <Stack>
      <Text fw={600}>Reagent Consumption & Reorder Report</Text>
      <DataTable columns={columns} data={consumption} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Section (Batch 2)
// ══════════════════════════════════════════════════════════

function TatAnalyticsSection() {
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["lab-tat-analytics"],
    queryFn: () => api.getLabTatAnalytics(),
  });

  const columns = [
    { key: "test_name", label: "Test", render: (row: LabTatAnalyticsRow) => <Text fw={500}>{row.test_name}</Text> },
    { key: "total_orders", label: "Total Completed", render: (row: LabTatAnalyticsRow) => <Text size="sm">{row.total_orders}</Text> },
    {
      key: "avg_tat", label: "Avg TAT (hrs)", render: (row: LabTatAnalyticsRow) => (
        <Text size="sm" fw={500}>
          {row.avg_tat_minutes != null ? (row.avg_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "p95_tat", label: "P95 TAT (hrs)", render: (row: LabTatAnalyticsRow) => (
        <Text size="sm" c={row.p95_tat_minutes != null && row.p95_tat_minutes > 1440 ? "danger" : undefined}>
          {row.p95_tat_minutes != null ? (row.p95_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "within_sla", label: "Within SLA", render: (row: LabTatAnalyticsRow) => {
        const rate = row.total_orders > 0 ? ((row.within_sla / row.total_orders) * 100).toFixed(1) : "0.0";
        const color = Number(rate) >= 90 ? "success" : Number(rate) >= 70 ? "warning" : "danger";
        return <Badge color={color} variant="light" size="sm">{rate}% ({row.within_sla}/{row.total_orders})</Badge>;
      },
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Turnaround Time Analytics</Text>
        <Text c="dimmed" size="sm">{tatData.length} test type(s)</Text>
      </Group>
      <DataTable columns={columns} data={tatData} loading={isLoading} rowKey={(row) => row.test_name} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Specialized Reports Tab (Phase 3)
// ══════════════════════════════════════════════════════════

function SpecializedReportsTab() {
  const [subTab, setSubTab] = useState("histopath");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "histopath")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="histopath">Histopathology</Tabs.Tab>
          <Tabs.Tab value="cytology">Cytology</Tabs.Tab>
          <Tabs.Tab value="molecular">Molecular / PCR</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="histopath"><HistopathSection /></Tabs.Panel>
        <Tabs.Panel value="cytology"><CytologySection /></Tabs.Panel>
        <Tabs.Panel value="molecular"><MolecularSection /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function HistopathSection() {
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateHistopathReportRequest>>({});
  const [lookupOrderId, setLookupOrderId] = useState("");

  const { data: report } = useQuery({
    queryKey: ["lab-histopath", lookupOrderId],
    queryFn: () => api.getHistopathReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHistopathReportRequest) => api.createHistopathReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-histopath"] });
      setShowForm(false);
      setForm({});
      notifications.show({ title: "Report created", message: "Histopathology report saved", color: "success" });
    },
  });

  return (
    <Stack>
      <Group>
        <TextInput size="xs" placeholder="Order ID to view report" value={lookupOrderId} onChange={(e) => setLookupOrderId(e.currentTarget.value)} w={300} />
      </Group>

      {report && (
        <Stack gap="xs" p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Text fw={600}>Histopathology Report</Text>
          <Text size="sm"><strong>Specimen:</strong> {report.specimen_type ?? "—"}</Text>
          <Text size="sm"><strong>Gross Description:</strong> {report.gross_description ?? "—"}</Text>
          <Text size="sm"><strong>Microscopy:</strong> {report.microscopy_findings ?? "—"}</Text>
          <Text size="sm"><strong>Diagnosis:</strong> {report.diagnosis ?? "—"}</Text>
          <Text size="sm"><strong>ICD Code:</strong> {report.icd_code ?? "—"}</Text>
          <Text size="sm"><strong>Turnaround:</strong> {report.turnaround_days != null ? `${report.turnaround_days} days` : "—"}</Text>
        </Stack>
      )}

      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>New Histopath Report</Button>
      )}

      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Order ID" required onChange={(e) => setForm({ ...form, order_id: e.currentTarget.value })} />
            <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
            <Select label="Specimen Type" data={SAMPLE_TYPES} onChange={(v) => setForm({ ...form, specimen_type: v || undefined })} clearable searchable />
          </Group>
          <Textarea label="Clinical History" autosize minRows={2} onChange={(e) => setForm({ ...form, clinical_history: e.currentTarget.value || undefined })} />
          <Textarea label="Gross Description" autosize minRows={2} onChange={(e) => setForm({ ...form, gross_description: e.currentTarget.value || undefined })} />
          <Textarea label="Microscopy Findings" autosize minRows={2} onChange={(e) => setForm({ ...form, microscopy_findings: e.currentTarget.value || undefined })} />
          <Group grow>
            <TextInput label="Diagnosis" onChange={(e) => setForm({ ...form, diagnosis: e.currentTarget.value || undefined })} />
            <TextInput label="ICD Code" onChange={(e) => setForm({ ...form, icd_code: e.currentTarget.value || undefined })} />
            <NumberInput label="Turnaround (days)" min={0} onChange={(v) => setForm({ ...form, turnaround_days: Number(v) || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateHistopathReportRequest)} loading={createMutation.isPending}>Save Report</Button>
        </Stack>
      )}
    </Stack>
  );
}

function CytologySection() {
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateCytologyReportRequest>>({});
  const [lookupOrderId, setLookupOrderId] = useState("");

  const { data: report } = useQuery({
    queryKey: ["lab-cytology", lookupOrderId],
    queryFn: () => api.getCytologyReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCytologyReportRequest) => api.createCytologyReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-cytology"] });
      setShowForm(false);
      setForm({});
      notifications.show({ title: "Report created", message: "Cytology report saved", color: "success" });
    },
  });

  return (
    <Stack>
      <Group>
        <TextInput size="xs" placeholder="Order ID to view report" value={lookupOrderId} onChange={(e) => setLookupOrderId(e.currentTarget.value)} w={300} />
      </Group>

      {report && (
        <Stack gap="xs" p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Text fw={600}>Cytology Report</Text>
          <Text size="sm"><strong>Specimen:</strong> {report.specimen_type ?? "—"}</Text>
          <Text size="sm"><strong>Adequacy:</strong> {report.adequacy ?? "—"}</Text>
          <Text size="sm"><strong>Screening:</strong> {report.screening_findings ?? "—"}</Text>
          <Text size="sm"><strong>Bethesda:</strong> {report.bethesda_category ?? "—"}</Text>
          <Text size="sm"><strong>Diagnosis:</strong> {report.diagnosis ?? "—"}</Text>
        </Stack>
      )}

      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>New Cytology Report</Button>
      )}

      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Order ID" required onChange={(e) => setForm({ ...form, order_id: e.currentTarget.value })} />
            <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
            <Select label="Specimen Type" data={SAMPLE_TYPES} onChange={(v) => setForm({ ...form, specimen_type: v || undefined })} clearable searchable />
          </Group>
          <TextInput label="Clinical Indication" onChange={(e) => setForm({ ...form, clinical_indication: e.currentTarget.value || undefined })} />
          <Group grow>
            <TextInput label="Adequacy" onChange={(e) => setForm({ ...form, adequacy: e.currentTarget.value || undefined })} />
            <Select
              label="Bethesda Category"
              data={[
                { value: "NILM", label: "NILM" },
                { value: "ASC-US", label: "ASC-US" },
                { value: "ASC-H", label: "ASC-H" },
                { value: "LSIL", label: "LSIL" },
                { value: "HSIL", label: "HSIL" },
                { value: "SCC", label: "SCC" },
                { value: "AGC", label: "AGC" },
                { value: "AIS", label: "AIS" },
              ]}
              clearable
              onChange={(v) => setForm({ ...form, bethesda_category: v || undefined })}
            />
          </Group>
          <Textarea label="Screening Findings" autosize minRows={2} onChange={(e) => setForm({ ...form, screening_findings: e.currentTarget.value || undefined })} />
          <Group grow>
            <TextInput label="Diagnosis" onChange={(e) => setForm({ ...form, diagnosis: e.currentTarget.value || undefined })} />
            <TextInput label="ICD Code" onChange={(e) => setForm({ ...form, icd_code: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateCytologyReportRequest)} loading={createMutation.isPending}>Save Report</Button>
        </Stack>
      )}
    </Stack>
  );
}

function MolecularSection() {
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateMolecularReportRequest>>({});
  const [lookupOrderId, setLookupOrderId] = useState("");

  const { data: report } = useQuery({
    queryKey: ["lab-molecular", lookupOrderId],
    queryFn: () => api.getMolecularReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMolecularReportRequest) => api.createMolecularReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-molecular"] });
      setShowForm(false);
      setForm({});
      notifications.show({ title: "Report created", message: "Molecular report saved", color: "success" });
    },
  });

  return (
    <Stack>
      <Group>
        <TextInput size="xs" placeholder="Order ID to view report" value={lookupOrderId} onChange={(e) => setLookupOrderId(e.currentTarget.value)} w={300} />
      </Group>

      {report && (
        <Stack gap="xs" p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Text fw={600}>Molecular / PCR Report</Text>
          <Text size="sm"><strong>Method:</strong> {report.test_method ?? "—"}</Text>
          <Text size="sm"><strong>Target Gene:</strong> {report.target_gene ?? "—"}</Text>
          <Text size="sm"><strong>Ct Value:</strong> {report.ct_value ?? "—"}</Text>
          <Text size="sm"><strong>Interpretation:</strong> {report.result_interpretation ?? "—"}</Text>
          <Text size="sm"><strong>Kit:</strong> {report.kit_name ?? "—"} (Lot: {report.kit_lot ?? "—"})</Text>
        </Stack>
      )}

      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>New Molecular Report</Button>
      )}

      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Order ID" required onChange={(e) => setForm({ ...form, order_id: e.currentTarget.value })} />
            <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
            <Select label="Test Method" data={MOLECULAR_TEST_METHODS} placeholder="Select method" onChange={(v) => setForm({ ...form, test_method: v || undefined })} clearable searchable />
          </Group>
          <Group grow>
            <TextInput label="Target Gene" onChange={(e) => setForm({ ...form, target_gene: e.currentTarget.value || undefined })} />
            <NumberInput label="Ct Value" decimalScale={2} onChange={(v) => setForm({ ...form, ct_value: Number(v) || undefined })} />
            <Select label="Interpretation" data={RESULT_INTERPRETATIONS} onChange={(v) => setForm({ ...form, result_interpretation: v || undefined })} clearable />
          </Group>
          <Group grow>
            <TextInput label="Kit Name" onChange={(e) => setForm({ ...form, kit_name: e.currentTarget.value || undefined })} />
            <TextInput label="Kit Lot" onChange={(e) => setForm({ ...form, kit_lot: e.currentTarget.value || undefined })} />
            <NumberInput label="Quantitative Value" decimalScale={4} onChange={(v) => setForm({ ...form, quantitative_value: Number(v) || undefined })} />
            <TextInput label="Unit" onChange={(e) => setForm({ ...form, quantitative_unit: e.currentTarget.value || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateMolecularReportRequest)} loading={createMutation.isPending}>Save Report</Button>
        </Stack>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  B2B Tab (Phase 3)
// ══════════════════════════════════════════════════════════

function B2bTab() {
  const [subTab, setSubTab] = useState("clients");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "clients")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="clients">Clients</Tabs.Tab>
          <Tabs.Tab value="rates">Rate Management</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="clients"><B2bClientsSection /></Tabs.Panel>
        <Tabs.Panel value="rates"><B2bRatesSection /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function B2bClientsSection() {
  const canManage = useHasPermission(P.LAB.B2B_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateB2bClientRequest>>({});

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["lab-b2b-clients"],
    queryFn: () => api.listB2bClients(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateB2bClientRequest) => api.createB2bClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-b2b-clients"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (row: LabB2bClient) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: LabB2bClient) => <Text size="sm">{row.name}</Text> },
    { key: "client_type", label: "Type", render: (row: LabB2bClient) => <Text size="sm">{row.client_type ?? "—"}</Text> },
    { key: "city", label: "City", render: (row: LabB2bClient) => <Text size="sm">{row.city ?? "—"}</Text> },
    { key: "contact_person", label: "Contact", render: (row: LabB2bClient) => <Text size="sm">{row.contact_person ?? "—"}</Text> },
    { key: "credit_limit", label: "Credit Limit", render: (row: LabB2bClient) => <Text size="sm">{row.credit_limit != null ? `₹${row.credit_limit}` : "—"}</Text> },
    { key: "payment_terms_days", label: "Terms", render: (row: LabB2bClient) => <Text size="sm">{row.payment_terms_days} days</Text> },
    { key: "is_active", label: "Active", render: (row: LabB2bClient) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Client</Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            <Select label="Type" data={B2B_CLIENT_TYPES} placeholder="Select type" onChange={(v) => setForm({ ...form, client_type: v || undefined })} clearable />
          </Group>
          <Group grow>
            <TextInput label="City" onChange={(e) => setForm({ ...form, city: e.currentTarget.value || undefined })} />
            <TextInput label="Phone" onChange={(e) => setForm({ ...form, phone: e.currentTarget.value || undefined })} />
            <TextInput label="Email" onChange={(e) => setForm({ ...form, email: e.currentTarget.value || undefined })} />
            <TextInput label="Contact Person" onChange={(e) => setForm({ ...form, contact_person: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Credit Limit" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, credit_limit: Number(v) || undefined })} />
            <NumberInput label="Payment Terms (days)" min={0} value={form.payment_terms_days ?? 30} onChange={(v) => setForm({ ...form, payment_terms_days: Number(v) || undefined })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateB2bClientRequest)} loading={createMutation.isPending}>Save</Button>
        </Stack>
      )}
      <DataTable columns={columns} data={clients} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

function B2bRatesSection() {
  const canManage = useHasPermission(P.LAB.B2B_MANAGE);
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateB2bRateRequest>>({});

  const { data: clients = [] } = useQuery({
    queryKey: ["lab-b2b-clients"],
    queryFn: () => api.listB2bClients(),
  });

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["lab-b2b-rates", selectedClientId],
    queryFn: () => api.listB2bRates(selectedClientId),
    enabled: !!selectedClientId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateB2bRateRequest) => api.createB2bRate(selectedClientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-b2b-rates", selectedClientId] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "test_id", label: "Test", render: (row: LabB2bRate) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text> },
    { key: "agreed_price", label: "Agreed Price", render: (row: LabB2bRate) => <Text size="sm">{row.agreed_price != null ? `₹${row.agreed_price}` : "—"}</Text> },
    { key: "discount_percent", label: "Discount", render: (row: LabB2bRate) => <Text size="sm">{row.discount_percent != null ? `${row.discount_percent}%` : "—"}</Text> },
    { key: "effective_from", label: "From", render: (row: LabB2bRate) => <Text size="sm">{row.effective_from ?? "—"}</Text> },
    { key: "effective_to", label: "To", render: (row: LabB2bRate) => <Text size="sm">{row.effective_to ?? "—"}</Text> },
  ];

  return (
    <Stack>
      <Select
        label="Select Client"
        placeholder="Choose a B2B client"
        data={clients.map((c: LabB2bClient) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        value={selectedClientId}
        onChange={(v) => setSelectedClientId(v ?? "")}
        w={400}
      />

      {selectedClientId && (
        <>
          {canManage && (
            <Group>
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>Add Rate</Button>
            </Group>
          )}
          {showForm && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="Test ID" required onChange={(e) => setForm({ ...form, test_id: e.currentTarget.value })} />
                <NumberInput label="Agreed Price" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, agreed_price: Number(v) || undefined })} />
                <NumberInput label="Discount %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, discount_percent: Number(v) || undefined })} />
              </Group>
              <Group grow>
                <TextInput label="Effective From" type="date" onChange={(e) => setForm({ ...form, effective_from: e.currentTarget.value || undefined })} />
                <TextInput label="Effective To" type="date" onChange={(e) => setForm({ ...form, effective_to: e.currentTarget.value || undefined })} />
              </Group>
              <Button size="xs" onClick={() => createMutation.mutate(form as CreateB2bRateRequest)} loading={createMutation.isPending}>Save</Button>
            </Stack>
          )}
          <DataTable columns={columns} data={rates} loading={isLoading} rowKey={(row) => row.id} />
        </>
      )}
    </Stack>
  );
}
