// INDENT AnalyticsPanel — split from indent.tsx (pure move).

import { Group, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import type {
  AbcAnalysisRow,
  ComplianceCheckRow,
  ConsumptionAnalysisRow,
  DeadStockRow,
  FsnAnalysisRow,
  InventoryValuationRow,
  PurchaseConsumptionTrendRow,
  VedAnalysisRow,
} from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { indentService } from "@/services/indent.service";
import { colorToBadgeTone } from "./shared";

function ConsumptionView() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [department, setDepartment] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => indentService.listDepartments(),
  });

  const params: Record<string, string> = {};
  if (fromDate) params.from = fromDate;
  if (toDate) params.to = toDate;
  if (department) params.department_id = department;

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-consumption", params],
    queryFn: () => indentService.getConsumptionAnalysis(params),
  });

  const columns = [
    { key: "item_name", label: "Item", render: (row: ConsumptionAnalysisRow) => row.item_name },
    {
      key: "department_name",
      label: "Department",
      render: (row: ConsumptionAnalysisRow) => row.department_name ?? "-",
    },
    {
      key: "total_issued",
      label: "Total Issued",
      render: (row: ConsumptionAnalysisRow) => row.total_issued,
    },
    {
      key: "total_value",
      label: "Total Value",
      render: (row: ConsumptionAnalysisRow) => `\u20B9${row.total_value}`,
    },
  ];

  const departmentOptions = (departments ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <Stack>
      <Group>
        <TextInput
          label="From Date"
          placeholder="YYYY-MM-DD"
          value={fromDate}
          onChange={(e) => setFromDate(e.currentTarget.value)}
          w={160}
        />
        <TextInput
          label="To Date"
          placeholder="YYYY-MM-DD"
          value={toDate}
          onChange={(e) => setToDate(e.currentTarget.value)}
          w={160}
        />
        <Select
          label="Department filter"
          placeholder="All departments"
          data={departmentOptions}
          value={department}
          onChange={setDepartment}
          clearable
          searchable
          w={220}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => `${row.item_name}-${row.department_name}`}
        emptyTitle="No consumption data"
      />
    </Stack>
  );
}

function AbcView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-abc"],
    queryFn: () => indentService.getAbcAnalysis(),
  });

  const abcColors: Record<string, BadgeTone> = { A: "danger", B: "warning", C: "success" };

  const columns = [
    { key: "item_name", label: "Item", render: (row: AbcAnalysisRow) => row.item_name },
    {
      key: "annual_value",
      label: "Annual Value",
      render: (row: AbcAnalysisRow) => `\u20B9${row.annual_value}`,
    },
    {
      key: "cumulative_pct",
      label: "Cumulative %",
      render: (row: AbcAnalysisRow) => `${row.cumulative_pct.toFixed(1)}%`,
    },
    {
      key: "abc_class",
      label: "Class",
      render: (row: AbcAnalysisRow) => (
        <Badge tone={abcColors[row.abc_class] ?? "neutral"} variant="filled" size="sm">
          {row.abc_class}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.item_name}
      emptyTitle="No ABC analysis data"
    />
  );
}

function VedView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-ved"],
    queryFn: () => indentService.getVedAnalysis(),
  });

  const classified = (data ?? []).filter((r) => r.ved_class);
  const unclassified = (data ?? []).filter((r) => !r.ved_class);

  const columns = [
    { key: "item_name", label: "Item", render: (row: VedAnalysisRow) => row.item_name },
    {
      key: "ved_class",
      label: "VED Class",
      render: (row: VedAnalysisRow) =>
        row.ved_class ? (
          <Badge tone={colorToBadgeTone(statusColor(row.ved_class))} variant="filled" size="sm">
            {row.ved_class}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            Unclassified
          </Text>
        ),
    },
    {
      key: "current_stock",
      label: "Current Stock",
      render: (row: VedAnalysisRow) => row.current_stock,
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      render: (row: VedAnalysisRow) => row.reorder_level,
    },
  ];

  return (
    <Stack>
      <DataTable
        columns={columns}
        data={classified}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No classified items"
      />
      {unclassified.length > 0 && (
        <>
          <Text fw={600} mt="md">
            <IconAlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Unclassified Items ({unclassified.length})
          </Text>
          <DataTable
            columns={columns}
            data={unclassified}
            loading={false}
            rowKey={(row) => row.item_name}
            emptyTitle="No unclassified items"
          />
        </>
      )}
    </Stack>
  );
}

function FsnView() {
  const [period, setPeriod] = useState("90");

  const params: Record<string, string> = { period_days: period };

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-fsn", params],
    queryFn: () => indentService.getFsnAnalysis(params),
  });

  const columns = [
    { key: "item_name", label: "Item", render: (row: FsnAnalysisRow) => row.item_name },
    {
      key: "last_issue_date",
      label: "Last Issue",
      render: (row: FsnAnalysisRow) =>
        row.last_issue_date ? new Date(row.last_issue_date).toLocaleDateString() : "Never",
    },
    {
      key: "days_since_last_issue",
      label: "Days Idle",
      render: (row: FsnAnalysisRow) => row.days_since_last_issue ?? "-",
    },
    {
      key: "fsn_class",
      label: "Class",
      render: (row: FsnAnalysisRow) => (
        <Badge tone={colorToBadgeTone(statusColor(row.fsn_class))} variant="filled" size="sm">
          {row.fsn_class.replace(/_/g, " ")}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          label="Period (days)"
          data={[
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
            { value: "90", label: "90 days" },
            { value: "180", label: "180 days" },
            { value: "365", label: "365 days" },
          ]}
          value={period}
          onChange={(v) => setPeriod(v ?? "90")}
          w={160}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No FSN analysis data"
      />
    </Stack>
  );
}

function DeadStockView() {
  const [threshold, setThreshold] = useState("180");

  const params: Record<string, string> = { threshold_days: threshold };

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-dead-stock", params],
    queryFn: () => indentService.getDeadStockReport(params),
  });

  const columns = [
    { key: "item_name", label: "Item", render: (row: DeadStockRow) => row.item_name },
    { key: "current_stock", label: "Stock", render: (row: DeadStockRow) => row.current_stock },
    {
      key: "stock_value",
      label: "Value",
      render: (row: DeadStockRow) => `\u20B9${row.stock_value}`,
    },
    {
      key: "last_movement_date",
      label: "Last Movement",
      render: (row: DeadStockRow) =>
        row.last_movement_date ? new Date(row.last_movement_date).toLocaleDateString() : "Never",
    },
    { key: "days_idle", label: "Days Idle", render: (row: DeadStockRow) => row.days_idle ?? "-" },
  ];

  return (
    <Stack>
      <Group>
        <Select
          label="Idle threshold (days)"
          data={[
            { value: "90", label: "90 days" },
            { value: "180", label: "180 days" },
            { value: "365", label: "365 days" },
          ]}
          value={threshold}
          onChange={(v) => setThreshold(v ?? "180")}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No dead stock items"
      />
    </Stack>
  );
}

function PurchaseConsumptionView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-pvc"],
    queryFn: () => indentService.getPurchaseConsumptionTrend(),
  });

  const columns = [
    { key: "period", label: "Period", render: (row: PurchaseConsumptionTrendRow) => row.period },
    {
      key: "total_purchased",
      label: "Purchased",
      render: (row: PurchaseConsumptionTrendRow) => row.total_purchased,
    },
    {
      key: "total_consumed",
      label: "Consumed",
      render: (row: PurchaseConsumptionTrendRow) => row.total_consumed,
    },
    {
      key: "net_change",
      label: "Net Change",
      render: (row: PurchaseConsumptionTrendRow) => (
        <Text size="sm" c={row.net_change >= 0 ? "success" : "danger"} fw={600}>
          {row.net_change >= 0 ? "+" : ""}
          {row.net_change}
        </Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.period}
      emptyTitle="No trend data"
    />
  );
}

function ValuationView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-valuation"],
    queryFn: () => indentService.getInventoryValuation(),
  });

  const grandTotal = (data ?? []).reduce((sum, r) => sum + Number(r.total_value), 0);

  const columns = [
    { key: "item_name", label: "Item", render: (row: InventoryValuationRow) => row.item_name },
    {
      key: "category",
      label: "Category",
      render: (row: InventoryValuationRow) => row.category ?? "-",
    },
    {
      key: "current_stock",
      label: "Stock",
      render: (row: InventoryValuationRow) => row.current_stock,
    },
    {
      key: "avg_unit_cost",
      label: "Avg Unit Cost",
      render: (row: InventoryValuationRow) => `\u20B9${row.avg_unit_cost}`,
    },
    {
      key: "total_value",
      label: "Total Value",
      render: (row: InventoryValuationRow) => `\u20B9${row.total_value}`,
    },
  ];

  return (
    <Stack>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No valuation data"
      />
      {(data ?? []).length > 0 && (
        <Group justify="flex-end">
          <Text fw={700} size="lg">
            Grand Total: {"\u20B9"}
            {grandTotal.toFixed(2)}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

function ComplianceView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-compliance"],
    queryFn: () => indentService.getComplianceReport(),
  });

  const columns = [
    { key: "check_name", label: "Check", render: (row: ComplianceCheckRow) => row.check_name },
    {
      key: "status",
      label: "Status",
      render: (row: ComplianceCheckRow) => (
        <Badge tone={row.status === "pass" ? "success" : "danger"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
    { key: "detail", label: "Detail", render: (row: ComplianceCheckRow) => row.detail },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.check_name}
      emptyTitle="No compliance data"
    />
  );
}

export function AnalyticsPanel() {
  const [view, setView] = useState("consumption");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Consumption", value: "consumption" },
          { label: "ABC", value: "abc" },
          { label: "VED", value: "ved" },
          { label: "FSN", value: "fsn" },
          { label: "Dead Stock", value: "dead-stock" },
          { label: "Purchase vs Consumption", value: "pvc" },
          { label: "Valuation", value: "valuation" },
          { label: "Compliance", value: "compliance" },
        ]}
      />
      {view === "consumption" && <ConsumptionView />}
      {view === "abc" && <AbcView />}
      {view === "ved" && <VedView />}
      {view === "fsn" && <FsnView />}
      {view === "dead-stock" && <DeadStockView />}
      {view === "pvc" && <PurchaseConsumptionView />}
      {view === "valuation" && <ValuationView />}
      {view === "compliance" && <ComplianceView />}
    </Stack>
  );
}

// ── Consumption Analysis ─────────────────────────────────
