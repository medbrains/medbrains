import { B2bTab } from "./lab/b2b";
import { LabCatalogTab } from "./lab/catalog";
import { LabDispatchSection } from "./lab/dispatch";
import { LabOrderDetail } from "./lab/order-detail";
import { OrderStatusPipeline } from "./lab/order-status-pipeline";
import { OutsourcedTab } from "./lab/outsourced";
import { LabPanelsTab } from "./lab/panels";
import { PhlebotomyTab } from "./lab/phlebotomy";
import { QcComplianceTab } from "./lab/qc-compliance";
import { SampleManagementTab } from "./lab/sample-management";
import { printLabReportPacket, statusColors } from "./lab/shared";
import { SpecializedReportsTab } from "./lab/specialized-reports";
import "@mantine/charts/styles.css";
import { Divider, Group, Select, Stack, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { LabCriticalAlert, LabOrder } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconEye,
  IconFlask,
  IconPlus,
  IconPrinter,
  IconSearch,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
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
  const navigate = useNavigate();
  const canCreateOrder = useHasPermission(P.LAB.ORDERS_CREATE);
  const canQc = useHasPermission(P.LAB.QC_LIST);
  const canPhlebotomy = useHasPermission(P.LAB.PHLEBOTOMY_LIST);
  const canOutsourced = useHasPermission(P.LAB.OUTSOURCED_LIST);
  const canSamples = useHasPermission(P.LAB.SAMPLES_LIST);
  const canSpecialized = useHasPermission(P.LAB.SPECIALIZED_LIST);
  const canB2b = useHasPermission(P.LAB.B2B_LIST);
  // The report print-data endpoint requires `lab.orders.view`, not
  // `lab.reports.view` -- that code gates the cumulative and TAT reports,
  // none of which are wired to a screen. Gating on it hid the print button
  // from everyone entitled to press it.
  const canPrintReports = useHasPermission(P.LAB.ORDERS_VIEW);
  const canDispatchList = useHasPermission(P.LAB.DISPATCH_LIST);
  const canDispatchManage = useHasPermission(P.LAB.DISPATCH_MANAGE);

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Debounced so a typed UHID does not fire a query per keystroke, and reset
  // to page 1 because results for "Sundaram" on page 4 of the unfiltered list
  // are nobody's search results.
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (filterPriority) params.priority = filterPriority;
  if (debouncedSearch.trim()) params.q = debouncedSearch.trim();

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
      key: "rejection",
      label: "",
      // A rejected sample sends the order back to `ordered`, where it is
      // indistinguishable from one never collected. The phlebotomist about to
      // draw again needs to know the first tube failed, and why, before they
      // repeat whatever caused it.
      render: (row: LabOrder) =>
        row.rejection_reason ? (
          <Tooltip label={row.rejection_reason}>
            <Badge size="xs" tone="warning">
              Re-draw
            </Badge>
          </Tooltip>
        ) : null,
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
              onClick={() => navigate(`/lab/orders/${row.id}`)}
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

  // Outstanding critical values.
  //
  // Filtered by the server, not here. This used to ask for the last hundred
  // alerts in the tenant and drop the acknowledged ones in the browser, so an
  // outstanding potassium fell out of the window as soon as the laboratory
  // logged a hundred more -- and the banner then said there were none.
  const { data: unacknowledgedAlerts = [], isError: alertsFailed } = useQuery({
    queryKey: ["lab-critical-alerts", { acknowledged: false }],
    queryFn: () => labService.listCriticalAlerts({ acknowledged: "false" }),
    refetchInterval: 30_000,
  });
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

      {/* An outage must not look like an all-clear. Rendering only on
          `length > 0` meant a failed fetch drew nothing, and nothing here
          reads as "no outstanding critical values". */}
      {alertsFailed && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={18} />}
          title="Critical alerts unavailable"
        >
          The outstanding critical values could not be loaded. This is not a statement that there
          are none — check again, and escalate by phone if a result is expected.
        </Alert>
      )}
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
          {canDispatchList && <Tabs.Tab value="dispatch">Dispatch</Tabs.Tab>}
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
            <TextInput
              placeholder="Patient, UHID, phone, test or barcode"
              aria-label="Search lab orders"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                // Page 1: results for a name on page 4 of the unfiltered list
                // are nobody's search results.
                setPage(1);
              }}
              w={280}
            />
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
                <Button
                  tone="primary"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate("/lab/orders/new")}
                >
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
        {canDispatchList && (
          <Tabs.Panel value="dispatch">
            <LabDispatchSection canManage={canDispatchManage} />
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
    </div>
  );
}

/**
 * The lab order on a route of its own rather than in a right-hand drawer.
 *
 * The detail is the bench's working screen — result entry, verification,
 * amendment, the printed report — and a drawer made all of that share the
 * worklist's width, could not be linked to, and lost its place on a refresh.
 * A technician handed "order for Sundaram" now gets a URL.
 */
export function LabOrderDetailPage() {
  useRequirePermission(P.LAB.ORDERS_VIEW);

  return (
    <ClinicalEventProvider moduleCode="lab" contextCode="lab-order-detail">
      <LabOrderDetailPageInner />
    </ClinicalEventProvider>
  );
}

function LabOrderDetailPageInner() {
  const { t } = useTranslation("lab");
  const navigate = useNavigate();
  const { orderId } = useParams();
  const canCreateOrder = useHasPermission(P.LAB.ORDERS_CREATE);
  const canCreateResult = useHasPermission(P.LAB.RESULTS_CREATE);
  const canVerify = useHasPermission(P.LAB.RESULTS_UPDATE);
  const canAmend = useHasPermission(P.LAB.RESULTS_AMEND);
  const canPrintReports = useHasPermission(P.LAB.ORDERS_VIEW);

  return (
    <Stack>
      <PageHeader
        title={t("title.labOrderDetail")}
        icon={<IconFlask size={20} stroke={1.5} />}
        actions={
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate("/lab")}
          >
            {t("title.laboratory")}
          </Button>
        }
      />
      {orderId ? (
        <LabOrderDetail
          orderId={orderId}
          canCreateResult={canCreateResult}
          canCreateOrder={canCreateOrder}
          canVerify={canVerify}
          canAmend={canAmend}
          canPrintReports={canPrintReports}
        />
      ) : (
        <Alert tone="warning">Lab order id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
