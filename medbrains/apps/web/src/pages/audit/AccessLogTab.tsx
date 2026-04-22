import { useState } from "react";
import {
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { AccessLogEntry, AccessLogQuery } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Constants ──────────────────────────────────────────

const PER_PAGE = 50;

// ── Component ──────────────────────────────────────────

export function AccessLogTab() {
  // Filter state
  const [patientSearch, setPatientSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [module, setModule] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  // Patient drill-down drawer
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Build query params
  const buildQuery = (): AccessLogQuery => {
    const q: AccessLogQuery = { page, per_page: PER_PAGE };
    if (patientSearch) q.patient_id = patientSearch;
    if (userSearch) q.user_id = userSearch;
    if (module) q.module = module;
    if (fromDate) q.from = fromDate.toISOString().split("T")[0];
    if (toDate) q.to = toDate.toISOString().split("T")[0];
    return q;
  };

  const filters = buildQuery();

  // Queries
  const { data: modules } = useQuery({
    queryKey: ["audit-modules"],
    queryFn: () => api.listAuditModules(),
  });

  const { data: accessEntries, isLoading } = useQuery({
    queryKey: ["access-log", filters],
    queryFn: () => api.listAccessLog(filters),
    refetchInterval: 60_000,
  });

  const { data: patientAccessLog } = useQuery({
    queryKey: ["patient-access-log", selectedPatientId],
    queryFn: () => api.getPatientAccessLog(selectedPatientId as string),
    enabled: !!selectedPatientId,
  });

  // Handlers
  const handlePatientClick = (patientId: string) => {
    setSelectedPatientId(patientId);
    openDrawer();
  };

  const handleClearFilters = () => {
    setPatientSearch("");
    setUserSearch("");
    setModule(null);
    setFromDate(null);
    setToDate(null);
    setPage(1);
  };

  // Main columns
  const columns: Column<AccessLogEntry>[] = [
    {
      key: "created_at",
      label: "Time",
      render: (r) => (
        <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "user_name",
      label: "User",
      render: (r) => <Text size="sm">{r.user_name ?? "System"}</Text>,
    },
    {
      key: "action",
      label: "Action",
      render: (r) => <Text size="sm">{r.action}</Text>,
    },
    {
      key: "entity_type",
      label: "Entity Type",
      render: (r) => <Text size="sm">{r.entity_type}</Text>,
    },
    {
      key: "entity_id",
      label: "Entity ID",
      render: (r) => (
        <Text size="xs" ff="monospace" c="dimmed">
          {r.entity_id ? r.entity_id.substring(0, 8) : "-"}
        </Text>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (r) =>
        r.patient_id ? (
          <Text
            size="sm"
            c="primary"
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={(e) => {
              e.stopPropagation();
              handlePatientClick(r.patient_id as string);
            }}
          >
            {r.patient_name ?? r.patient_id.substring(0, 8)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        ),
    },
    {
      key: "module",
      label: "Module",
      render: (r) => <Text size="sm">{r.module ?? "-"}</Text>,
    },
    {
      key: "ip_address",
      label: "IP Address",
      render: (r) => (
        <Text size="xs" ff="monospace" c="dimmed">
          {r.ip_address ?? "-"}
        </Text>
      ),
    },
  ];

  // Drawer columns
  const drawerColumns: Column<AccessLogEntry>[] = [
    {
      key: "created_at",
      label: "Time",
      render: (r) => (
        <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "user_name",
      label: "User",
      render: (r) => <Text size="sm">{r.user_name ?? "System"}</Text>,
    },
    {
      key: "action",
      label: "Action",
      render: (r) => <Text size="sm">{r.action}</Text>,
    },
    {
      key: "module",
      label: "Module",
      render: (r) => <Text size="sm">{r.module ?? "-"}</Text>,
    },
    {
      key: "ip_address",
      label: "IP",
      render: (r) => (
        <Text size="xs" ff="monospace" c="dimmed">
          {r.ip_address ?? "-"}
        </Text>
      ),
    },
  ];

  const totalPages = accessEntries ? Math.ceil(accessEntries.length / PER_PAGE) : 0;

  return (
    <Stack gap="md">
      {/* Filters */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Patient ID..."
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          size="sm"
          w={180}
        />
        <TextInput
          placeholder="User..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          size="sm"
          w={180}
        />
        <Select
          placeholder="Module"
          data={modules?.map((m) => ({ value: m, label: m })) ?? []}
          value={module}
          onChange={setModule}
          clearable
          size="sm"
          w={160}
        />
        <DateInput
          placeholder="From date"
          value={fromDate}
          onChange={(v) => setFromDate(v ? new Date(v) : null)}
          clearable
          size="sm"
          w={150}
        />
        <DateInput
          placeholder="To date"
          value={toDate}
          onChange={(v) => setToDate(v ? new Date(v) : null)}
          clearable
          size="sm"
          w={150}
        />
        <Button variant="subtle" size="sm" onClick={handleClearFilters}>
          Clear
        </Button>
      </Group>

      {/* Table */}
      <DataTable
        columns={columns}
        data={accessEntries ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        page={page}
        totalPages={totalPages}
        perPage={PER_PAGE}
        onPageChange={setPage}
        total={accessEntries?.length}
        emptyTitle="No access log entries"
        emptyDescription="No record access events found for the given filters."
      />

      {/* Patient Access Drill-Down Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Patient Access Log"
        position="right"
        size="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Patient ID: {selectedPatientId ?? "-"}
          </Text>
          <DataTable
            columns={drawerColumns}
            data={patientAccessLog ?? []}
            loading={!patientAccessLog && !!selectedPatientId}
            rowKey={(r) => r.id}
            emptyTitle="No access records"
            emptyDescription="No one has accessed this patient record yet."
          />
        </Stack>
      </Drawer>
    </Stack>
  );
}
