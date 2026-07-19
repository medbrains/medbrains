import { zodResolver } from "@hookform/resolvers/zod";
import { confirmDestructive } from "@/lib/confirm";
import { B2bClientsSection } from "./lab/b2b-clients";
import { B2bRatesSection } from "./lab/b2b-rates";
import { CalibrationsSection } from "./lab/calibrations";
import { CollectionCentersSection } from "./lab/collection-centers";
import { CytologySection } from "./lab/cytology";
import { EqasSection } from "./lab/eqas";
import { HistopathSection } from "./lab/histopath";
import { HomeCollectionsSection } from "./lab/home-collections";
import { MolecularSection } from "./lab/molecular";
import { NablDocumentsSection } from "./lab/nabl-documents";
import { ProficiencyTestingSection } from "./lab/proficiency-testing";
import { ReagentLotsSection } from "./lab/reagent-lots";
import { SampleArchiveSection } from "./lab/sample-archive";
import {
  flagColors,
  phlebotomyStatusColors,
  printLabReportPacket,
  statusColors,
  toBadgeTone,
  toLabPriority,
  toLabResultFlag,
} from "./lab/shared";
import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  LabCatalogFormInput,
  LabOutsourcedOrderFormInput,
  LabPanelFormInput,
  LabQcResultFormInput,
} from "@medbrains/schemas";
import {
  labCatalogFormSchema,
  labOutsourcedOrderFormSchema,
  labPanelFormSchema,
  labQcResultFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmendResultRequest,
  AutoValidateResult,
  CreateLabCatalogRequest,
  CreateLabOrderRequest,
  CreateLabPanelRequest,
  CreateOutsourcedOrderRequest,
  CreateQcResultRequest,
  LabCriticalAlert,
  LabOrder,
  LabOrderDetailResponse,
  LabOutsourcedOrder,
  LabPhlebotomyQueueItem,
  LabPriority,
  LabQcResult,
  LabReagentLot,
  LabResult,
  LabTatAnalyticsRow,
  LabTestCatalog,
  LabTestPanel,
  ReagentConsumptionRow,
  ResultInput,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconDroplet,
  IconEye,
  IconFlask,
  IconLock,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRobot,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  ClinicalEventProvider,
  CsvImportModal,
  DataTable,
  DocumentActions,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Input,
  Modal,
  toast,
} from "@/components/ui";
import {
  labMethodOptions,
  labNumberOrFallback,
  labOptionalInteger,
  labOptionalNumber,
  labOptionalText,
  labSampleTypeOptions,
} from "@/forms/lab.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { AnionGapTab } from "@/pages/lab/AnionGapTab";
import { OsmolarGapTab } from "@/pages/lab/OsmolarGapTab";
import { labService } from "@/services/lab.service";

export function LabPage() {
  useRequirePermission(P.LAB.ORDERS_LIST);

  return (
    <ClinicalEventProvider moduleCode="lab" contextCode="lab-orders">
      <LabPageInner />
    </ClinicalEventProvider>
  );
}

function LabPageInner() {
  const { t } = useTranslation("lab");
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
  const canPrintReports = useHasPermission(P.LAB.REPORTS_VIEW);

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
    queryFn: () => labService.listLabOrders(params),
  });

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabOrder) => <PatientNameCell patientId={row.patient_id} showUhid={false} />,
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
        <StatusDot color={statusColor(row.priority) ?? "slate"} label={row.priority} />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabOrder) => (
        <StatusDot
          color={statusColors[row.status] ?? "slate"}
          label={row.status.replace(/_/g, " ")}
        />
      ),
    },
    {
      key: "report_status",
      label: "Report",
      render: (row: LabOrder) =>
        row.report_status ? (
          <Badge size="xs" tone={row.is_report_locked ? "danger" : "primary"}>
            {row.report_status}
            {row.is_report_locked ? " (locked)" : ""}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "created_at",
      label: "Ordered",
      render: (row: LabOrder) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabOrder) => (
        <Group gap="xs">
          <Tooltip label={t("label.view")}>
            <IconButton
              onClick={() => {
                setSelectedOrderId(row.id);
                openDetail();
              }}
              aria-label={t("aria.viewDetails")}
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canPrintReports && row.status === "verified" && (
            <Tooltip label="Print report">
              <IconButton
                tone="success"
                onClick={() => {
                  void printLabReportPacket(row.id);
                }}
                aria-label="Print report"
              >
                <IconPrinter size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  // Critical alerts count — general overview
  const { data: criticalAlerts = [] } = useQuery({
    queryKey: ["lab-critical-alerts"],
    queryFn: () => labService.listCriticalAlerts(),
    refetchInterval: 30_000,
  });

  const unacknowledgedAlerts = criticalAlerts.filter((a: LabCriticalAlert) => !a.acknowledged_at);
  // NABL: a critical value must be communicated AND acknowledged within a target time. Surface any
  // that have gone unacknowledged past the target so they can be chased.
  const CRITICAL_ACK_TARGET_MINUTES = 30;
  const isAckOverdue = (a: LabCriticalAlert) =>
    !!a.notified_at &&
    Date.now() - new Date(a.notified_at).getTime() > CRITICAL_ACK_TARGET_MINUTES * 60_000;
  const overdueCount = unacknowledgedAlerts.filter(isAckOverdue).length;
  const sortedUnackAlerts = [...unacknowledgedAlerts].sort(
    (a, b) => Number(isAckOverdue(b)) - Number(isAckOverdue(a)),
  );

  return (
    <div>
      <PageHeader
        title={t("title.laboratory")}
        subtitle={t("subtitle.labOrders,Results,Qc&Compliance")}
        icon={<IconFlask size={20} stroke={1.5} />}
        color="violet"
      />

      {unacknowledgedAlerts.length > 0 && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={18} />}
          title={`${unacknowledgedAlerts.length} unacknowledged critical alert(s)${
            overdueCount > 0
              ? ` — ${overdueCount} overdue for acknowledgement (> ${CRITICAL_ACK_TARGET_MINUTES}m)`
              : ""
          }`}
          mb="md"
        >
          <Group gap="xs" wrap="wrap">
            {sortedUnackAlerts.slice(0, 5).map((a: LabCriticalAlert) => (
              <Badge key={a.id} tone="danger" variant="filled" size="sm">
                {a.parameter_name}: {a.value} ({a.flag.replace(/_/g, " ")})
                {isAckOverdue(a) ? " · overdue" : ""}
              </Badge>
            ))}
            {unacknowledgedAlerts.length > 5 && (
              <Text size="xs" c="danger" fw={500}>
                +{unacknowledgedAlerts.length - 5} more
              </Text>
            )}
          </Group>
        </Alert>
      )}

      <Tabs defaultValue="orders">
        <Tabs.List mb="md">
          <Tabs.Tab value="orders">{t("orders")}</Tabs.Tab>
          <Tabs.Tab value="catalog">{t("testCatalog")}</Tabs.Tab>
          <Tabs.Tab value="panels">{t("panelsProfiles")}</Tabs.Tab>
          {canPhlebotomy && <Tabs.Tab value="phlebotomy">{t("phlebotomy")}</Tabs.Tab>}
          {canSamples && <Tabs.Tab value="samples">{t("sampleMgmt")}</Tabs.Tab>}
          {canQc && <Tabs.Tab value="qc">{t("qc&Compliance")}</Tabs.Tab>}
          {canSpecialized && <Tabs.Tab value="specialized">{t("specialized")}</Tabs.Tab>}
          {canB2b && <Tabs.Tab value="b2b">{t("b2b")}</Tabs.Tab>}
          {canOutsourced && <Tabs.Tab value="outsourced">{t("outsourced")}</Tabs.Tab>}
          <Tabs.Tab value="calculators">{t("calculators")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="orders">
          <OrderStatusPipeline
            orders={data?.orders ?? []}
            activeStatus={filterStatus}
            onStatusClick={(status) => setFilterStatus(filterStatus === status ? null : status)}
          />
          <Group mb="md">
            <Select
              placeholder={t("placeholder.status")}
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
              placeholder={t("label.priority")}
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
            tableActions={
              canCreateOrder ? (
                <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
                  New Order
                </Button>
              ) : undefined
            }
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

        <Tabs.Panel value="calculators">
          <Stack gap="xl">
            <AnionGapTab />
            <Divider />
            <OsmolarGapTab />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <CreateLabOrderDrawer opened={createOpened} onClose={closeCreate} />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={t("title.labOrderDetail")}
        position="right"
        size="lg"
      >
        {selectedOrderId && (
          <LabOrderDetail
            orderId={selectedOrderId}
            canCreateResult={canCreateResult}
            canVerify={canVerify}
            canAmend={canAmend}
            canPrintReports={canPrintReports}
          />
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
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {s.label}
          </Text>
          <Text size="xl" fw={700}>
            {counts[s.value]}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function CreateLabOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation("lab");

  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [priority, setPriority] = useState<LabPriority>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateLabOrderRequest) => labService.createLabOrder(data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({ title: "Order created", message: "Lab order placed", color: "success" });
      emit("order.created", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        order_type: "lab",
        patient_id: result.patient_id,
        priority: result.priority,
        test_id: result.test_id,
        source_test_id: variables.test_id,
      });
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
    <Drawer
      opened={opened}
      onClose={onClose}
      title={t("title.newLabOrder")}
      position="right"
      size="xl"
    >
      <Stack>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <PatientContextBanner patientId={patientId} hideLoadingState />
        <LabTestSearchSelect value={testId} onChange={(id) => setTestId(id)} required />
        <EncounterSelect
          value={encounterId}
          onChange={(id) => setEncounterId(id)}
          patientId={patientId || undefined}
        />
        <Select
          label={t("label.priority")}
          data={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
            { value: "stat", label: "STAT" },
          ]}
          value={priority}
          onChange={(value) => setPriority(toLabPriority(value))}
        />
        <TextInput
          label={t("label.clinicalNotes")}
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.currentTarget.value)}
        />
        <Button
          tone="primary"
          onClick={() =>
            createMutation.mutate({
              patient_id: patientId,
              test_id: testId,
              encounter_id: encounterId || undefined,
              priority,
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

function LabOrderDetail({
  orderId,
  canCreateResult,
  canVerify,
  canAmend,
  canPrintReports,
}: {
  orderId: string;
  canCreateResult: boolean;
  canVerify: boolean;
  canAmend: boolean;
  canPrintReports: boolean;
}) {
  const { t } = useTranslation("lab");
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [resultFormOpen, resultFormHandlers] = useDisclosure(false);
  const [collectOpened, { open: openCollect, close: closeCollect }] = useDisclosure(false);
  const [scannedId, setScannedId] = useState("");
  const [resultInputs, setResultInputs] = useState<ResultInput[]>([
    { parameter_name: "", value: "" },
  ]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amendData, setAmendData] = useState<{
    resultId: string;
    value: string;
    reason: string;
  } | null>(null);

  const { data } = useQuery<LabOrderDetailResponse>({
    queryKey: ["lab-order-detail", orderId],
    queryFn: () => labService.getLabOrder(orderId),
  });

  // Critical alerts for this order
  const { data: alerts = [] } = useQuery({
    queryKey: ["lab-critical-alerts"],
    queryFn: () => labService.listCriticalAlerts(),
  });

  const orderAlerts = alerts.filter(
    (a: LabCriticalAlert) => a.order_id === orderId && !a.acknowledged_at,
  );

  const collectMutation = useMutation({
    mutationFn: (patientIdentifier: string) =>
      labService.collectSample(orderId, { patient_identifier: patientIdentifier }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      closeCollect();
      setScannedId("");
      toast.success("Identity confirmed — sample collected", { title: "Sample collected" });
      emit("lab.sample_collected", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        sample_barcode: result.sample_barcode,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Identity check failed" }),
  });
  const processMutation = useMutation({
    mutationFn: () => labService.startProcessing(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not start processing" }),
  });
  const completeMutation = useMutation({
    mutationFn: () => labService.completeLabOrder(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.order.completed", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        result_status: result.status,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not complete order" }),
  });
  const verifyMutation = useMutation({
    mutationFn: () => labService.verifyResults(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.result.verified", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        result_status: result.status,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not verify results" }),
  });
  const cancelMutation = useMutation({
    mutationFn: () => labService.cancelLabOrder(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not cancel order" }),
  });
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => labService.rejectSample(orderId, { rejection_reason: reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setRejectionReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not reject sample" }),
  });
  const addResultsMutation = useMutation({
    mutationFn: () => labService.addLabResults(orderId, { results: resultInputs }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      emit("lab.results_entered", {
        order_id: orderId,
        patient_id: data?.order.patient_id,
        result_count: resultInputs.length,
      });
      resultFormHandlers.close();
      setResultInputs([{ parameter_name: "", value: "" }]);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save results" }),
  });

  // Report status mutations
  const reportStatusMutation = useMutation({
    mutationFn: (status: string) =>
      labService.updateLabReportStatus(orderId, {
        report_status: status as "preliminary" | "final" | "amended",
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not update report status" }),
  });
  const lockReportMutation = useMutation({
    mutationFn: () => labService.lockLabReport(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not lock report" }),
  });
  const [ackAlert, setAckAlert] = useState<LabCriticalAlert | null>(null);
  const [readback, setReadback] = useState("");
  const acknowledgeMutation = useMutation({
    mutationFn: (vars: { alertId: string; readback_value: string }) =>
      labService.acknowledgeCriticalAlert(vars.alertId, { readback_value: vars.readback_value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      setAckAlert(null);
      setReadback("");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Read-back", message: e.message, color: "danger" }),
  });
  const amendMutation = useMutation({
    mutationFn: (data: AmendResultRequest) => labService.amendLabResult(orderId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      setAmendData(null);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not amend result" }),
  });
  const addOnMutation = useMutation({
    mutationFn: (testId: string) => labService.addOnLabTest(orderId, { test_id: testId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({
        title: "Add-on test created",
        message: "Linked order created",
        color: "success",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not add on test" }),
  });

  const autoValidateMutation = useMutation({
    mutationFn: (resultId: string) => labService.autoValidateResult(resultId),
    onSuccess: (result: AutoValidateResult) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
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
    queryFn: () => labService.getOrderCrossmatch(orderId),
    enabled: !!orderId,
    retry: false,
  });

  if (!data) return <Text c="dimmed">{t("loading...")}</Text>;

  const order = data.order;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Order: {order.id.slice(0, 8)}...</Text>
        <Badge tone={toBadgeTone(statusColors[order.status])} size="lg">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </Group>
      <PatientContextBanner patientId={order.patient_id} hideLoadingState />
      <Group>
        <Badge tone={toBadgeTone(statusColor(order.priority))} variant="dot">
          Priority: {order.priority}
        </Badge>
        {order.report_status && (
          <Badge tone={order.is_report_locked ? "danger" : "primary"} size="sm">
            Report: {order.report_status}
            {order.is_report_locked ? " (locked)" : ""}
          </Badge>
        )}
        {order.is_outsourced && (
          <Badge tone="accent" size="sm">
            Outsourced
          </Badge>
        )}
        {order.parent_order_id && (
          <Badge tone="primary" size="sm">
            Add-on
          </Badge>
        )}
        {crossmatchData && crossmatchData.crossmatch_requests.length > 0 && (
          <Badge tone="danger" size="sm" leftSection={<IconDroplet size={12} />}>
            Crossmatch ({crossmatchData.crossmatch_requests.length})
          </Badge>
        )}
      </Group>

      {/* Critical alerts banner */}
      {orderAlerts.length > 0 && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={16} />}
          title={t("title.criticalValues")}
        >
          {orderAlerts.map((a: LabCriticalAlert) => (
            <Group key={a.id} justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {a.parameter_name}: {a.value} ({a.flag.replace(/_/g, " ")})
              </Text>
              <Button
                tone="subtle-danger"
                size="xs"
                onClick={() => {
                  setReadback("");
                  setAckAlert(a);
                }}
              >
                Acknowledge
              </Button>
            </Group>
          ))}
        </Alert>
      )}

      {ackAlert && (
        <Modal
          opened
          onClose={() => setAckAlert(null)}
          title="Acknowledge critical result — read back"
          size="sm"
        >
          <Stack gap="sm">
            <Text size="sm">
              Read back the value for <b>{ackAlert.parameter_name}</b> to confirm you received it
              correctly.
            </Text>
            <TextInput
              label="Read-back value"
              placeholder="Type the value you were told"
              value={readback}
              onChange={(e) => setReadback(e.currentTarget.value)}
            />
            <Button
              tone="primary"
              loading={acknowledgeMutation.isPending}
              disabled={!readback.trim()}
              onClick={() =>
                acknowledgeMutation.mutate({
                  alertId: ackAlert.id,
                  readback_value: readback.trim(),
                })
              }
            >
              Confirm acknowledgement
            </Button>
          </Stack>
        </Modal>
      )}

      <Modal
        opened={collectOpened}
        onClose={closeCollect}
        title="Confirm patient identity"
        size="sm"
      >
        <Stack gap="md">
          <Alert tone="warning" title="Positive patient identification">
            Confirm you are drawing from the right patient. Scan the wristband (or key the UHID) —
            the system checks it against this order to prevent wrong-blood-in-tube.
          </Alert>

          <Card withBorder padding="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Collecting from
            </Text>
            <PatientNameCell patientId={order.patient_id} showUhid={false} />
          </Card>

          <Input
            label="Scan wristband / enter UHID"
            placeholder="Scan the patient's wristband"
            value={scannedId}
            onChange={(e) => setScannedId(e.currentTarget.value)}
            autoFocus
          />

          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeCollect}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={collectMutation.isPending}
              disabled={!scannedId.trim()}
              onClick={() => collectMutation.mutate(scannedId.trim())}
            >
              Confirm &amp; collect
            </Button>
          </Group>
        </Stack>
      </Modal>

      {order.rejection_reason && (
        <Badge tone="danger" size="lg">
          Rejected: {order.rejection_reason}
        </Badge>
      )}

      {/* Status transition buttons */}
      {canCreateResult && (
        <Group>
          {order.status === "ordered" && (
            <Button tone="primary" size="xs" onClick={openCollect}>
              {t("collectSample")}
            </Button>
          )}
          {order.status === "sample_collected" && (
            <Button tone="primary" size="xs" onClick={() => processMutation.mutate()}>
              {t("startProcessing")}
            </Button>
          )}
          {order.status === "processing" && (
            <Button tone="primary" size="xs" onClick={() => completeMutation.mutate()}>
              {t("complete")}
            </Button>
          )}
          {order.status === "ordered" && (
            <Button
              tone="subtle-danger"
              size="xs"
              onClick={() =>
                confirmDestructive({
                  title: "Cancel order",
                  message: "Cancel this lab order? This cannot be undone.",
                  confirmLabel: "Cancel order",
                  cancelLabel: "Keep",
                  onConfirm: () => cancelMutation.mutate(),
                })
              }
            >
              {t("cancel")}
            </Button>
          )}
          {(order.status === "ordered" || order.status === "sample_collected") && (
            <Group gap="xs">
              <TextInput
                size="xs"
                placeholder={t("placeholder.rejectionReason")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.currentTarget.value)}
                w={200}
              />
              <Button
                tone="danger"
                size="xs"
                disabled={!rejectionReason}
                onClick={() => rejectMutation.mutate(rejectionReason)}
                loading={rejectMutation.isPending}
              >
                Reject Sample
              </Button>
            </Group>
          )}
        </Group>
      )}
      {canVerify && order.status === "completed" && (
        <Button tone="primary" size="xs" onClick={() => verifyMutation.mutate()}>
          {t("verifyResults")}
        </Button>
      )}
      {canPrintReports && order.status === "verified" && (
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconPrinter size={14} />}
          onClick={() => {
            void printLabReportPacket(order.id);
          }}
        >
          Print report
        </Button>
      )}
      {canPrintReports && order.status === "verified" && (
        <DocumentActions templateCode="lab_report" sourceId={order.id} />
      )}

      {/* Report status controls */}
      {canVerify &&
        (order.status === "completed" || order.status === "verified") &&
        !order.is_report_locked && (
          <Group>
            <Button
              tone="secondary"
              size="xs"
              onClick={() => reportStatusMutation.mutate("preliminary")}
            >
              {t("setPreliminary")}
            </Button>
            <Button tone="secondary" size="xs" onClick={() => reportStatusMutation.mutate("final")}>
              {t("setFinal")}
            </Button>
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconLock size={14} />}
              onClick={() => lockReportMutation.mutate()}
            >
              {t("lockReport")}
            </Button>
          </Group>
        )}

      <Text fw={600} mt="md">
        {t("results")}
      </Text>
      <DataTable
        columns={[
          { key: "parameter", label: "Parameter", render: (r: LabResult) => r.parameter_name },
          {
            key: "value",
            label: "Value",
            render: (r: LabResult) => <Text fw={500}>{r.value}</Text>,
          },
          { key: "unit", label: "Unit", render: (r: LabResult) => r.unit ?? "—" },
          { key: "range", label: "Range", render: (r: LabResult) => r.normal_range ?? "—" },
          {
            key: "flag",
            label: "Flag",
            render: (r: LabResult) =>
              r.flag ? (
                <Badge tone={flagColors[r.flag] ?? "neutral"} size="sm">
                  {r.flag.replace(/_/g, " ")}
                </Badge>
              ) : (
                "—"
              ),
          },
          {
            key: "delta",
            label: "Delta",
            render: (r: LabResult) =>
              r.is_delta_flagged ? (
                <Badge tone="danger" size="sm">
                  Δ {r.delta_percent ? `${Number(r.delta_percent).toFixed(1)}%` : "flagged"}
                </Badge>
              ) : r.delta_percent ? (
                <Text size="xs" c="dimmed">
                  {Number(r.delta_percent).toFixed(1)}%
                </Text>
              ) : (
                "—"
              ),
          },
          ...(canVerify && !order.is_report_locked
            ? [
                {
                  key: "auto-validate",
                  label: "Auto-Validate",
                  render: (r: LabResult) =>
                    (order.status === "completed" || order.status === "processing") && (
                      <Tooltip label={t("label.autoValidateResult")}>
                        <IconButton
                          size="xs"
                          tone="success"
                          loading={autoValidateMutation.isPending}
                          onClick={() => autoValidateMutation.mutate(r.id)}
                          aria-label={t("aria.robot")}
                        >
                          <IconRobot size={12} />
                        </IconButton>
                      </Tooltip>
                    ),
                },
              ]
            : []),
          ...(canAmend && !order.is_report_locked
            ? [
                {
                  key: "amend",
                  label: "Amend",
                  render: (r: LabResult) => (
                    <IconButton
                      size="xs"
                      onClick={() => setAmendData({ resultId: r.id, value: r.value, reason: "" })}
                      aria-label={t("aria.refresh")}
                    >
                      <IconRefresh size={12} />
                    </IconButton>
                  ),
                },
              ]
            : []),
        ]}
        data={data?.results ?? []}
        rowKey={(r) => r.id}
      />

      {/* Amendment form */}
      {amendData && (
        <Stack
          gap="xs"
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Text size="sm" fw={600}>
            {t("amendResult")}
          </Text>
          <TextInput
            size="xs"
            label={t("label.newValue")}
            value={amendData.value}
            onChange={(e) => setAmendData({ ...amendData, value: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label={t("label.reason(required)")}
            value={amendData.reason}
            onChange={(e) => setAmendData({ ...amendData, reason: e.currentTarget.value })}
          />
          <Group>
            <Button
              tone="primary"
              size="xs"
              disabled={!amendData.reason}
              onClick={() =>
                amendMutation.mutate({
                  result_id: amendData.resultId,
                  amended_value: amendData.value,
                  reason: amendData.reason,
                })
              }
              loading={amendMutation.isPending}
            >
              Save Amendment
            </Button>
            <Button tone="secondary" size="xs" onClick={() => setAmendData(null)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      {/* Add results form */}
      {canCreateResult &&
        (order.status === "processing" || order.status === "sample_collected") && (
          <>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={resultFormHandlers.toggle}
            >
              Add Results
            </Button>
            {resultFormOpen && (
              <Stack gap="xs">
                {resultInputs.map((ri, idx) => (
                  <Group
                    key={`${ri.parameter_name || "parameter"}-${ri.value || "value"}-${ri.unit || "unit"}`}
                    grow
                  >
                    <TextInput
                      placeholder={t("parameter")}
                      value={ri.parameter_name}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, parameter_name: e.currentTarget.value };
                        setResultInputs(updated);
                      }}
                    />
                    <TextInput
                      placeholder={t("value")}
                      value={ri.value}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, value: e.currentTarget.value };
                        setResultInputs(updated);
                      }}
                    />
                    <TextInput
                      placeholder={t("unit")}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, unit: e.currentTarget.value || undefined };
                        setResultInputs(updated);
                      }}
                    />
                    <Select
                      placeholder={t("flag")}
                      data={["normal", "low", "high", "critical_low", "critical_high", "abnormal"]}
                      clearable
                      onChange={(v) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, flag: toLabResultFlag(v) };
                        setResultInputs(updated);
                      }}
                    />
                  </Group>
                ))}
                <Group>
                  <Button
                    tone="secondary"
                    size="xs"
                    onClick={() =>
                      setResultInputs([...resultInputs, { parameter_name: "", value: "" }])
                    }
                  >
                    Add Row
                  </Button>
                  <Button
                    tone="primary"
                    size="xs"
                    onClick={() => addResultsMutation.mutate()}
                    loading={addResultsMutation.isPending}
                  >
                    Save Results
                  </Button>
                </Group>
              </Stack>
            )}
          </>
        )}

      {/* Add-on test */}
      {canCreateResult && order.status !== "cancelled" && (
        <AddOnTestSection
          onAddOn={(testId) => addOnMutation.mutate(testId)}
          isPending={addOnMutation.isPending}
        />
      )}
    </Stack>
  );
}

function AddOnTestSection({
  onAddOn,
  isPending,
}: {
  onAddOn: (testId: string) => void;
  isPending: boolean;
}) {
  const [testId, setTestId] = useState("");
  return (
    <Group mt="sm">
      <TextInput
        size="xs"
        placeholder="Test ID for add-on"
        value={testId}
        onChange={(e) => setTestId(e.currentTarget.value)}
        w={250}
      />
      <Button
        tone="secondary"
        size="xs"
        disabled={!testId}
        loading={isPending}
        onClick={() => {
          onAddOn(testId);
          setTestId("");
        }}
      >
        Add-on Test
      </Button>
    </Group>
  );
}

// ══════════════════════════════════════════════════════════
//  Test Catalog Tab (enhanced with Phase 2 fields)
// ══════════════════════════════════════════════════════════

function LabCatalogTab({ canCreate }: { canCreate: boolean }) {
  const { t } = useTranslation("lab");

  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [importOpen, importHandlers] = useDisclosure(false);
  const catalogDefaults: LabCatalogFormInput = {
    code: "",
    name: "",
    sample_type: "",
    normal_range: "",
    unit: "",
    price: 0,
    tat_hours: "",
    loinc_code: "",
    method: "",
    specimen_volume: "",
    critical_low: "",
    critical_high: "",
    delta_check_percent: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabCatalogFormInput>({
    resolver: zodResolver(labCatalogFormSchema),
    defaultValues: catalogDefaults,
  });

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => labService.listLabCatalog(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLabCatalogRequest) => labService.createLabCatalogEntry(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-catalog"] });
      formHandlers.close();
      reset(catalogDefaults);
    },
  });

  const handleCreateCatalog = (values: LabCatalogFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      sample_type: labOptionalText(values.sample_type),
      normal_range: labOptionalText(values.normal_range),
      unit: labOptionalText(values.unit),
      price: labNumberOrFallback(values.price, 0),
      tat_hours: labOptionalInteger(values.tat_hours),
      loinc_code: labOptionalText(values.loinc_code),
      method: labOptionalText(values.method),
      specimen_volume: labOptionalText(values.specimen_volume),
      critical_low: labOptionalNumber(values.critical_low),
      critical_high: labOptionalNumber(values.critical_high),
      delta_check_percent: labOptionalNumber(values.delta_check_percent),
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: LabTestCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: LabTestCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "sample_type",
      label: "Sample",
      render: (row: LabTestCatalog) => <Text size="sm">{row.sample_type ?? "—"}</Text>,
    },
    {
      key: "loinc_code",
      label: "LOINC",
      render: (row: LabTestCatalog) => <Text size="sm">{row.loinc_code ?? "—"}</Text>,
    },
    {
      key: "price",
      label: "Price",
      render: (row: LabTestCatalog) => <Text size="sm">₹{row.price}</Text>,
    },
    {
      key: "tat_hours",
      label: "TAT",
      render: (row: LabTestCatalog) => (
        <Text size="sm">{row.tat_hours ? `${row.tat_hours}h` : "—"}</Text>
      ),
    },
    {
      key: "critical",
      label: "Critical Range",
      render: (row: LabTestCatalog) => (
        <Text size="sm">
          {row.critical_low || row.critical_high
            ? `${row.critical_low ?? "—"} – ${row.critical_high ?? "—"}`
            : "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabTestCatalog) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) reset(catalogDefaults);
              formHandlers.toggle();
            }}
          >
            Add Test
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconUpload size={14} />}
            onClick={importHandlers.open}
          >
            Import CSV
          </Button>
        </Group>
      )}
      <CsvImportModal
        opened={importOpen}
        onClose={() => {
          importHandlers.close();
          void queryClient.invalidateQueries({ queryKey: ["lab-catalog"] });
        }}
        title="Import lab test catalog"
        requiredColumns={["code", "name"]}
        optionalColumns={[
          "sample_type",
          "normal_range",
          "unit",
          "price",
          "tat_hours",
          "loinc_code",
          "critical_low",
          "critical_high",
        ]}
        onImport={(data) => labService.importLabCatalog(data)}
      />
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCatalog)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              error={errors.name?.message}
              {...register("name")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="sample_type"
              render={({ field }) => (
                <Select
                  label={t("label.sampleType")}
                  data={labSampleTypeOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.sample_type?.message}
                  clearable
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.normalRange")}
              placeholder={t("placeholder.e.g.70100")}
              error={errors.normal_range?.message}
              {...register("normal_range")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("unit")}
              placeholder={t("placeholder.e.g.MgDl")}
              error={errors.unit?.message}
              {...register("unit")}
            />
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <NumberInput
                  label={t("label.price")}
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.price?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tat_hours"
              render={({ field }) => (
                <NumberInput
                  label={t("label.tat(hours)")}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tat_hours?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.loincCode")}
              placeholder={t("placeholder.e.g.23457")}
              error={errors.loinc_code?.message}
              {...register("loinc_code")}
            />
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  label={t("label.method")}
                  data={labMethodOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.method?.message}
                  clearable
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.specimenVolume")}
              placeholder={t("placeholder.e.g.5Ml")}
              error={errors.specimen_volume?.message}
              {...register("specimen_volume")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="critical_low"
              render={({ field }) => (
                <NumberInput
                  label={t("label.criticalLow")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.critical_low?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="critical_high"
              render={({ field }) => (
                <NumberInput
                  label={t("label.criticalHigh")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.critical_high?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="delta_check_percent"
              render={({ field }) => (
                <NumberInput
                  label={t("label.deltaCheck%")}
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.delta_check_percent?.message}
                />
              )}
            />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
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
  const { t } = useTranslation("lab");

  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [testIdInput, setTestIdInput] = useState("");
  const panelDefaults: LabPanelFormInput = {
    code: "",
    name: "",
    description: "",
    price: 0,
    test_ids: [],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LabPanelFormInput>({
    resolver: zodResolver(labPanelFormSchema),
    defaultValues: panelDefaults,
  });
  const selectedTestIds = watch("test_ids");

  const { data: panels = [], isLoading } = useQuery({
    queryKey: ["lab-panels"],
    queryFn: () => labService.listLabPanels(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLabPanelRequest) => labService.createLabPanel(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-panels"] });
      formHandlers.close();
      reset(panelDefaults);
      setTestIdInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labService.deleteLabPanel(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-panels"] }),
  });

  const addTestId = () => {
    const testId = testIdInput.trim();
    if (testId && !selectedTestIds.includes(testId)) {
      setValue("test_ids", [...selectedTestIds, testId], {
        shouldDirty: true,
        shouldValidate: true,
      });
      setTestIdInput("");
    }
  };

  const removeTestId = (index: number) => {
    setValue(
      "test_ids",
      selectedTestIds.filter((_, currentIndex) => currentIndex !== index),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const handleCreatePanel = (values: LabPanelFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      description: labOptionalText(values.description),
      price: labNumberOrFallback(values.price, 0),
      test_ids: values.test_ids,
    });
  };

  const columns = [
    { key: "code", label: "Code", render: (row: LabTestPanel) => <Text fw={500}>{row.code}</Text> },
    {
      key: "name",
      label: "Name",
      render: (row: LabTestPanel) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (row: LabTestPanel) => <Text size="sm">{row.description ?? "—"}</Text>,
    },
    {
      key: "price",
      label: "Price",
      render: (row: LabTestPanel) => <Text size="sm">₹{row.price}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabTestPanel) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabTestPanel) => (
        <IconButton
          tone="danger"
          onClick={() =>
            confirmDestructive({
              title: "Delete",
              message: "Permanently delete this record? This cannot be undone.",
              onConfirm: () => deleteMutation.mutate(row.id),
            })
          }
          aria-label={t("aria.close")}
        >
          <IconX size={14} />
        </IconButton>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) {
                reset(panelDefaults);
                setTestIdInput("");
              }
              formHandlers.toggle();
            }}
          >
            Add Panel
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreatePanel)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              placeholder={t("placeholder.e.g.Cbc")}
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              placeholder={t("placeholder.e.g.CompleteBloodCount")}
              error={errors.name?.message}
              {...register("name")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.description")}
              error={errors.description?.message}
              {...register("description")}
            />
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <NumberInput
                  label={t("label.panelPrice")}
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.price?.message}
                />
              )}
            />
          </Group>
          <Group>
            <LabTestSearchSelect
              value={testIdInput}
              onChange={(id) => setTestIdInput(id)}
              label={t("label.addTestId")}
            />
            <Button tone="secondary" size="xs" mt={24} onClick={addTestId}>
              Add
            </Button>
          </Group>
          {errors.test_ids?.message && <Alert tone="danger">{errors.test_ids.message}</Alert>}
          {selectedTestIds.length > 0 && (
            <Group gap="xs">
              {selectedTestIds.map((tid, i) => (
                <Badge
                  key={tid}
                  rightSection={
                    <IconButton
                      size="xs"
                      onClick={() => removeTestId(i)}
                      aria-label={t("aria.close")}
                    >
                      <IconX size={10} />
                    </IconButton>
                  }
                >
                  {tid.slice(0, 8)}...
                </Badge>
              ))}
            </Group>
          )}
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
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
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.PHLEBOTOMY_MANAGE);
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["lab-phlebotomy-queue"],
    queryFn: () => labService.listPhlebotomyQueue(),
    refetchInterval: 15_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labService.updatePhlebotomyStatus(id, {
        status: status as "in_progress" | "completed" | "skipped" | "waiting",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-phlebotomy-queue"] }),
  });

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabPhlebotomyQueueItem) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "order_id",
      label: "Order",
      render: (row: LabPhlebotomyQueueItem) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: LabPhlebotomyQueueItem) => (
        <StatusDot color={statusColor(row.priority) ?? "slate"} label={row.priority} />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabPhlebotomyQueueItem) => (
        <Badge tone={phlebotomyStatusColors[row.status] ?? "neutral"} size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "queued_at",
      label: "Queued",
      render: (row: LabPhlebotomyQueueItem) => (
        <Text size="sm">{new Date(row.queued_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabPhlebotomyQueueItem) =>
        canManage ? (
          <Group gap="xs">
            {row.status === "waiting" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "in_progress" })}
              >
                Start
              </Button>
            )}
            {row.status === "in_progress" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "completed" })}
              >
                Complete
              </Button>
            )}
            {(row.status === "waiting" || row.status === "in_progress") && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "skipped" })}
              >
                Skip
              </Button>
            )}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <Stack>
      <Text fw={600}>{t("phlebotomyCollectionQueue")}</Text>
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
          <Tabs.Tab value="tat-analytics" leftSection={<IconClock size={14} />}>
            TAT Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reagent-lots">
          <ReagentLotsSection />
        </Tabs.Panel>
        <Tabs.Panel value="qc-results">
          <QcResultsSection />
        </Tabs.Panel>
        <Tabs.Panel value="calibrations">
          <CalibrationsSection />
        </Tabs.Panel>
        <Tabs.Panel value="eqas">
          <EqasSection />
        </Tabs.Panel>
        <Tabs.Panel value="proficiency">
          <ProficiencyTestingSection />
        </Tabs.Panel>
        <Tabs.Panel value="nabl">
          <NablDocumentsSection />
        </Tabs.Panel>
        <Tabs.Panel value="consumption">
          <ReagentConsumptionSection />
        </Tabs.Panel>
        <Tabs.Panel value="tat-analytics">
          <TatAnalyticsSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function QcResultsSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [chartLotId, setChartLotId] = useState<string | null>(null);
  const qcDefaults: LabQcResultFormInput = {
    test_id: "",
    lot_id: "",
    level: "",
    target_mean: "",
    target_sd: "",
    observed_value: "",
    run_date: "",
    reviewer_notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabQcResultFormInput>({
    resolver: zodResolver(labQcResultFormSchema),
    defaultValues: qcDefaults,
  });

  const { data: qcResults = [], isLoading } = useQuery({
    queryKey: ["lab-qc-results"],
    queryFn: () => labService.listQcResults(),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["lab-reagent-lots"],
    queryFn: () => labService.listReagentLots(),
  });
  const lotOptions = lots.map((lot) => ({
    value: lot.id,
    label: `${lot.reagent_name} · ${lot.lot_number}`,
  }));

  const createMutation = useMutation({
    mutationFn: (data: CreateQcResultRequest) => labService.createQcResult(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-qc-results"] });
      formHandlers.close();
      reset(qcDefaults);
    },
  });

  const handleCreateQcResult = (values: LabQcResultFormInput) => {
    createMutation.mutate({
      test_id: values.test_id.trim(),
      lot_id: values.lot_id.trim(),
      level: values.level.trim(),
      target_mean: labOptionalNumber(values.target_mean),
      target_sd: labOptionalNumber(values.target_sd),
      observed_value: labOptionalNumber(values.observed_value),
      run_date: labOptionalText(values.run_date),
      reviewer_notes: labOptionalText(values.reviewer_notes),
    });
  };

  const columns = [
    {
      key: "test_id",
      label: "Test",
      render: (row: LabQcResult) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text>,
    },
    {
      key: "level",
      label: "Level",
      render: (row: LabQcResult) => <Text size="sm">{row.level}</Text>,
    },
    {
      key: "observed_value",
      label: "Observed",
      render: (row: LabQcResult) => <Text size="sm">{row.observed_value ?? "—"}</Text>,
    },
    {
      key: "sd_index",
      label: "SD Index",
      render: (row: LabQcResult) => (
        <Text size="sm" fw={row.sd_index && Math.abs(Number(row.sd_index)) > 2 ? 700 : 400}>
          {row.sd_index ?? "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabQcResult) => (
        <Badge tone={toBadgeTone(statusColor(row.status))} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "westgard",
      label: "Westgard",
      render: (row: LabQcResult) =>
        row.westgard_violations?.length ? (
          <Badge tone="danger" size="sm">
            {row.westgard_violations.join(", ")}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            OK
          </Text>
        ),
    },
    {
      key: "run_date",
      label: "Run Date",
      render: (row: LabQcResult) => <Text size="sm">{row.run_date ?? "—"}</Text>,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) reset(qcDefaults);
              formHandlers.toggle();
            }}
          >
            {t("addQcResult")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateQcResult)}>
          <Group grow>
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <LabTestSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.test_id?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="lot_id"
              render={({ field }) => (
                <Select
                  label={t("label.lotId")}
                  data={lotOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.lot_id?.message}
                  required
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.level")}
              required
              placeholder={t("placeholder.e.g.L1,L2")}
              error={errors.level?.message}
              {...register("level")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="target_mean"
              render={({ field }) => (
                <NumberInput
                  label={t("label.targetMean")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.target_mean?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="target_sd"
              render={({ field }) => (
                <NumberInput
                  label={t("label.targetSd")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.target_sd?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="observed_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.observedValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.observed_value?.message}
                />
              )}
            />
          </Group>
          <TextInput
            label={t("label.runDate")}
            type="date"
            error={errors.run_date?.message}
            {...register("run_date")}
            w={200}
          />
          <Textarea
            label={t("reviewerNotes")}
            error={errors.reviewer_notes?.message}
            {...register("reviewer_notes")}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
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
  const { t } = useTranslation("lab");
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
      <Text fw={600} size="sm">
        {t("leveyJenningsQcChart")}
      </Text>
      <Select
        label={t("label.selectReagentLot")}
        placeholder={t("placeholder.chooseALotToViewQcChart")}
        data={lots.map((l) => ({ value: l.id, label: `${l.reagent_name} — Lot ${l.lot_number}` }))}
        value={selectedLotId}
        onChange={onLotChange}
        clearable
        w={400}
      />
      {selectedLotId && !hasData && (
        <Text size="sm" c="dimmed">
          No QC results with target mean/SD found for this lot. Ensure QC results have target_mean
          and target_sd values.
        </Text>
      )}
      {selectedLotId && hasData && (
        <Stack gap="xs">
          <Group gap="lg">
            <Badge tone="primary">Mean: {mean.toFixed(2)}</Badge>
            <Badge tone="success">SD: {sd.toFixed(2)}</Badge>
            <Badge tone="neutral">{chartData.length} points</Badge>
          </Group>
          <Group gap="xs">
            <Badge size="xs" tone="success" variant="dot">
              Within 1SD
            </Badge>
            <Badge size="xs" tone="warning" variant="dot">
              1-2 SD
            </Badge>
            <Badge size="xs" tone="warning" variant="dot">
              2-3 SD
            </Badge>
            <Badge size="xs" tone="danger" variant="dot">
              Beyond 3SD
            </Badge>
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

function OutsourcedTab() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.OUTSOURCED_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const outsourcedDefaults: LabOutsourcedOrderFormInput = {
    order_id: "",
    external_lab_name: "",
    external_lab_code: "",
    sent_date: "",
    expected_return_date: "",
    cost: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabOutsourcedOrderFormInput>({
    resolver: zodResolver(labOutsourcedOrderFormSchema),
    defaultValues: outsourcedDefaults,
  });

  const { data: outsourced = [], isLoading } = useQuery({
    queryKey: ["lab-outsourced"],
    queryFn: () => labService.listOutsourcedOrders(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateOutsourcedOrderRequest) => labService.createOutsourcedOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] });
      formHandlers.close();
      reset(outsourcedDefaults);
    },
  });

  const handleCreateOutsourcedOrder = (values: LabOutsourcedOrderFormInput) => {
    createMutation.mutate({
      order_id: values.order_id.trim(),
      external_lab_name: values.external_lab_name.trim(),
      external_lab_code: labOptionalText(values.external_lab_code),
      sent_date: labOptionalText(values.sent_date),
      expected_return_date: labOptionalText(values.expected_return_date),
      cost: labOptionalNumber(values.cost),
      notes: labOptionalText(values.notes),
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labService.updateOutsourcedOrder(id, {
        status: status as "pending_send" | "sent" | "result_received" | "cancelled",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] }),
  });

  const columns = [
    {
      key: "order_id",
      label: "Order",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text>,
    },
    {
      key: "external_lab_name",
      label: "External Lab",
      render: (row: LabOutsourcedOrder) => <Text fw={500}>{row.external_lab_name}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabOutsourcedOrder) => (
        <Badge tone={toBadgeTone(statusColor(row.status))} size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "sent_date",
      label: "Sent",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.sent_date ?? "—"}</Text>,
    },
    {
      key: "expected_return_date",
      label: "Expected",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.expected_return_date ?? "—"}</Text>,
    },
    {
      key: "cost",
      label: "Cost",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.cost ? `₹${row.cost}` : "—"}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabOutsourcedOrder) =>
        canManage ? (
          <Group gap="xs">
            {row.status === "pending_send" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ id: row.id, status: "sent" })}
              >
                Mark Sent
              </Button>
            )}
            {row.status === "sent" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ id: row.id, status: "result_received" })}
              >
                Result Received
              </Button>
            )}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              formHandlers.toggle();
              if (formOpen) reset(outsourcedDefaults);
            }}
          >
            {t("outsourceOrder")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateOutsourcedOrder)}>
          <Group grow>
            <TextInput
              label={t("label.orderId")}
              required
              error={errors.order_id?.message}
              {...register("order_id")}
            />
            <TextInput
              label={t("label.externalLabName")}
              required
              error={errors.external_lab_name?.message}
              {...register("external_lab_name")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.labCode")}
              error={errors.external_lab_code?.message}
              {...register("external_lab_code")}
            />
            <TextInput
              label={t("label.sentDate")}
              type="date"
              error={errors.sent_date?.message}
              {...register("sent_date")}
            />
            <TextInput
              label={t("label.expectedReturn")}
              type="date"
              error={errors.expected_return_date?.message}
              {...register("expected_return_date")}
            />
          </Group>
          <Controller
            control={control}
            name="cost"
            render={({ field }) => (
              <NumberInput
                label={t("label.cost")}
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={errors.cost?.message}
                w={200}
              />
            )}
          />
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={outsourced} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Sample Management Tab (Phase 3)
// ══════════════════════════════════════════════════════════

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
        <Tabs.Panel value="home-collections">
          <HomeCollectionsSection />
        </Tabs.Panel>
        <Tabs.Panel value="collection-centers">
          <CollectionCentersSection />
        </Tabs.Panel>
        <Tabs.Panel value="sample-archive">
          <SampleArchiveSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ReagentConsumptionSection() {
  const { t } = useTranslation("lab");
  const { data: consumption = [], isLoading } = useQuery({
    queryKey: ["lab-reagent-consumption"],
    queryFn: () => labService.getReagentConsumption(),
  });

  const columns = [
    {
      key: "reagent_name",
      label: "Reagent",
      render: (row: ReagentConsumptionRow) => <Text fw={500}>{row.reagent_name}</Text>,
    },
    {
      key: "lot_number",
      label: "Lot #",
      render: (row: ReagentConsumptionRow) => <Text size="sm">{row.lot_number}</Text>,
    },
    {
      key: "quantity",
      label: "Qty",
      render: (row: ReagentConsumptionRow) => (
        <Text size="sm">
          {row.quantity != null ? `${row.quantity} ${row.quantity_unit ?? ""}` : "—"}
        </Text>
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder",
      render: (row: ReagentConsumptionRow) => <Text size="sm">{row.reorder_level ?? "—"}</Text>,
    },
    {
      key: "consumption_per_test",
      label: "Per Test",
      render: (row: ReagentConsumptionRow) => (
        <Text size="sm">{row.consumption_per_test ?? "—"}</Text>
      ),
    },
    {
      key: "below_reorder",
      label: "Status",
      render: (row: ReagentConsumptionRow) => {
        if (row.reorder_level == null || row.quantity == null)
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        return row.quantity <= row.reorder_level ? (
          <Badge tone="danger" size="sm">
            Below Reorder
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            OK
          </Badge>
        );
      },
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: ReagentConsumptionRow) => {
        if (!row.expiry_date) return <Text size="sm">—</Text>;
        const isExpired = new Date(row.expiry_date) < new Date();
        return (
          <Badge tone={isExpired ? "danger" : "success"} size="sm">
            {row.expiry_date}
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Text fw={600}>{t("reagentConsumption&ReorderReport")}</Text>
      <DataTable
        columns={columns}
        data={consumption}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Section (Batch 2)
// ══════════════════════════════════════════════════════════

function TatAnalyticsSection() {
  const { t } = useTranslation("lab");
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["lab-tat-analytics"],
    queryFn: () => labService.getLabTatAnalytics(),
  });

  const columns = [
    {
      key: "test_name",
      label: "Test",
      render: (row: LabTatAnalyticsRow) => <Text fw={500}>{row.test_name}</Text>,
    },
    {
      key: "total_orders",
      label: "Total Completed",
      render: (row: LabTatAnalyticsRow) => <Text size="sm">{row.total_orders}</Text>,
    },
    {
      key: "avg_tat",
      label: "Avg TAT (hrs)",
      render: (row: LabTatAnalyticsRow) => (
        <Text size="sm" fw={500}>
          {row.avg_tat_minutes != null ? (row.avg_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "p95_tat",
      label: "P95 TAT (hrs)",
      render: (row: LabTatAnalyticsRow) => (
        <Text
          size="sm"
          c={row.p95_tat_minutes != null && row.p95_tat_minutes > 1440 ? "danger" : undefined}
        >
          {row.p95_tat_minutes != null ? (row.p95_tat_minutes / 60).toFixed(1) : "---"}
        </Text>
      ),
    },
    {
      key: "within_sla",
      label: "Within SLA",
      render: (row: LabTatAnalyticsRow) => {
        const rate =
          row.total_orders > 0 ? ((row.within_sla / row.total_orders) * 100).toFixed(1) : "0.0";
        const tone: BadgeTone =
          Number(rate) >= 90 ? "success" : Number(rate) >= 70 ? "warning" : "danger";
        return (
          <Badge tone={tone} size="sm">
            {rate}% ({row.within_sla}/{row.total_orders})
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>{t("turnaroundTimeAnalytics")}</Text>
        <Text c="dimmed" size="sm">
          {tatData.length} test type(s)
        </Text>
      </Group>
      <DataTable
        columns={columns}
        data={tatData}
        loading={isLoading}
        rowKey={(row) => row.test_name}
      />
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
        <Tabs.Panel value="histopath">
          <HistopathSection />
        </Tabs.Panel>
        <Tabs.Panel value="cytology">
          <CytologySection />
        </Tabs.Panel>
        <Tabs.Panel value="molecular">
          <MolecularSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function B2bTab() {
  const [subTab, setSubTab] = useState("clients");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "clients")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="clients">Clients</Tabs.Tab>
          <Tabs.Tab value="rates">Rate Management</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="clients">
          <B2bClientsSection />
        </Tabs.Panel>
        <Tabs.Panel value="rates">
          <B2bRatesSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
