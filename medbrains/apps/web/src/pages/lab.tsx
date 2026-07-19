import { B2bClientsSection } from "./lab/b2b-clients";
import { B2bRatesSection } from "./lab/b2b-rates";
import { CalibrationsSection } from "./lab/calibrations";
import { LabCatalogTab } from "./lab/catalog";
import { CollectionCentersSection } from "./lab/collection-centers";
import { CytologySection } from "./lab/cytology";
import { EqasSection } from "./lab/eqas";
import { HistopathSection } from "./lab/histopath";
import { HomeCollectionsSection } from "./lab/home-collections";
import { MolecularSection } from "./lab/molecular";
import { NablDocumentsSection } from "./lab/nabl-documents";
import { LabOrderDetail } from "./lab/order-detail";
import { OutsourcedTab } from "./lab/outsourced";
import { LabPanelsTab } from "./lab/panels";
import { PhlebotomyTab } from "./lab/phlebotomy";
import { ProficiencyTestingSection } from "./lab/proficiency-testing";
import { QcResultsSection } from "./lab/qc-results";
import { ReagentConsumptionSection } from "./lab/reagent-consumption";
import { ReagentLotsSection } from "./lab/reagent-lots";
import { SampleArchiveSection } from "./lab/sample-archive";
import { printLabReportPacket, statusColors, toLabPriority } from "./lab/shared";
import { TatAnalyticsSection } from "./lab/tat-analytics";
import "@mantine/charts/styles.css";
import {
  Card,
  Divider,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateLabOrderRequest,
  LabCriticalAlert,
  LabOrder,
  LabPriority,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconClock,
  IconEye,
  IconFlask,
  IconPlus,
  IconPrinter,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClinicalEventProvider,
  DataTable,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton } from "@/components/ui";
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
