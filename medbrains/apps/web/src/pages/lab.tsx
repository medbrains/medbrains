import { B2bClientsSection } from "./lab/b2b-clients";
import { B2bRatesSection } from "./lab/b2b-rates";
import { LabCatalogTab } from "./lab/catalog";
import { CollectionCentersSection } from "./lab/collection-centers";
import { CreateLabOrderDrawer } from "./lab/create-order-drawer";
import { CytologySection } from "./lab/cytology";
import { HistopathSection } from "./lab/histopath";
import { HomeCollectionsSection } from "./lab/home-collections";
import { MolecularSection } from "./lab/molecular";
import { LabOrderDetail } from "./lab/order-detail";
import { OrderStatusPipeline } from "./lab/order-status-pipeline";
import { OutsourcedTab } from "./lab/outsourced";
import { LabPanelsTab } from "./lab/panels";
import { PhlebotomyTab } from "./lab/phlebotomy";
import { QcComplianceTab } from "./lab/qc-compliance";
import { SampleArchiveSection } from "./lab/sample-archive";
import { printLabReportPacket, statusColors } from "./lab/shared";
import "@mantine/charts/styles.css";
import { Divider, Drawer, Group, Select, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { LabCriticalAlert, LabOrder } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconEye, IconFlask, IconPlus, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClinicalEventProvider, DataTable, PageHeader, StatusDot } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
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
