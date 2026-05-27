import {
  ActionIcon,
  Badge,
  Button,
  Card,
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
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateMrdBirthRequest,
  CreateMrdDeathRequest,
  CreateMrdRecordRequest,
  CreateMrdRetentionPolicyRequest,
  CreateMrdStorageLocationRequest,
  FileMrdCaseSheetPacketRequest,
  IssueMrdRecordRequest,
  MrdAdmissionDischargeSummary,
  MrdBirthRegister,
  MrdCaseSheetCompletenessResponse,
  MrdCaseSheetPacket,
  MrdCaseSheetPacketStatus,
  MrdCaseSheetPage,
  MrdDeathRegister,
  MrdMedicalRecord,
  MrdMorbidityMortalityResponse,
  MrdRecordMovement,
  MrdRetentionPolicy,
  MrdStorageLocation,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArchive,
  IconArrowBack,
  IconArrowRight,
  IconBabyCarriage,
  IconChartBar,
  IconClipboardList,
  IconFileCertificate,
  IconMapPin,
  IconPlus,
  IconPrinter,
  IconShieldCheck,
  IconSkull,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "../components";
import type { Column } from "../components/DataTable";
import { DepartmentSelect } from "../components/DepartmentSelect";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { mrdService } from "../services/mrd.service";

// ── Helpers ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "success",
  archived: "primary",
  destroyed: "slate",
  missing: "danger",
  draft: "slate",
  generated: "primary",
  printed: "warning",
  filed: "success",
  deficient: "danger",
  voided: "slate",
  available: "success",
  pending: "warning",
  waived: "slate",
  issued: "warning",
  returned: "success",
  overdue: "danger",
};

const CASE_SHEET_STATUS_OPTIONS: { value: MrdCaseSheetPacketStatus | ""; label: string }[] = [
  { value: "", label: "All case sheets" },
  { value: "generated", label: "Generated" },
  { value: "printed", label: "Printed" },
  { value: "filed", label: "Filed" },
  { value: "deficient", label: "Deficient" },
  { value: "issued", label: "Issued" },
  { value: "returned", label: "Returned" },
  { value: "voided", label: "Voided" },
];

function toCaseSheetStatus(value: string | null): MrdCaseSheetPacketStatus | null {
  switch (value) {
    case "draft":
    case "generated":
    case "printed":
    case "filed":
    case "issued":
    case "returned":
    case "deficient":
    case "voided":
      return value;
    default:
      return null;
  }
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function completenessColor(status: string): string {
  if (status === "ok") return "success";
  if (status === "missing") return "danger";
  return "warning";
}

function MrdCompletenessPanel({
  completeness,
  loading,
}: {
  completeness: MrdCaseSheetCompletenessResponse | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card withBorder p="sm">
        <Text size="sm" c="dimmed">
          Checking OPD/IPD/pharmacy/billing linkages...
        </Text>
      </Card>
    );
  }
  if (!completeness) return null;

  const openItems = completeness.items.filter((item) => item.status !== "ok");
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" align="flex-start" mb="sm">
        <Stack gap={2}>
          <Text fw={600}>MRD Completeness</Text>
          <Text size="xs" c="dimmed">
            Current evidence from OPD, IPD, pharmacy, lab, radiology, billing, and consent modules.
          </Text>
        </Stack>
        <Group gap="xs">
          <Badge color={completeness.missing_total > 0 ? "danger" : "success"} variant="light">
            {completeness.completeness_pct}% complete
          </Badge>
          <Badge color="slate" variant="outline">
            {completeness.complete_total}/{completeness.required_total} required
          </Badge>
        </Group>
      </Group>
      {openItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          Required case-sheet evidence is complete for this packet.
        </Text>
      ) : (
        <Stack gap={6}>
          {openItems.map((item) => (
            <Group key={item.code} justify="space-between" align="flex-start">
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.message}
                </Text>
              </Stack>
              <Group gap={6}>
                <Badge size="xs" color={completenessColor(item.status)} variant="light">
                  {item.status}
                </Badge>
                <Badge size="xs" color="slate" variant="outline">
                  {item.source_module}
                </Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}

/** Generate shelf/rack options: shelves A-F, racks 1-10 */
const MRD_SHELF_OPTIONS = (() => {
  const options: { value: string; label: string }[] = [];
  for (const shelf of ["A", "B", "C", "D", "E", "F"]) {
    for (let rack = 1; rack <= 10; rack++) {
      const code = `${shelf}-${rack}`;
      options.push({ value: code, label: `Shelf ${shelf}, Rack ${rack}` });
    }
  }
  return options;
})();

const FILING_METHOD_OPTIONS = [
  { value: "alphabetical", label: "Alphabetical (by patient name)" },
  { value: "terminal_digit", label: "Terminal Digit (last 2 digits of UHID)" },
  { value: "yearly", label: "Yearly (by year of first visit)" },
];

// ══════════════════════════════════════════════════════════
//  Page
// ══════════════════════════════════════════════════════════

export function MrdPage() {
  useRequirePermission(P.MRD.RECORDS_LIST);
  const [tab, setTab] = useState<string | null>("records");

  return (
    <div>
      <PageHeader
        title="Medical Records Department"
        subtitle="Record indexing, birth/death registries, statistics"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconFileCertificate size={16} />}>
            Records
          </Tabs.Tab>
          <Tabs.Tab value="case-sheets" leftSection={<IconClipboardList size={16} />}>
            Case Sheets
          </Tabs.Tab>
          <Tabs.Tab value="storage" leftSection={<IconArchive size={16} />}>
            Storage
          </Tabs.Tab>
          <Tabs.Tab value="births" leftSection={<IconBabyCarriage size={16} />}>
            Birth Register
          </Tabs.Tab>
          <Tabs.Tab value="deaths" leftSection={<IconSkull size={16} />}>
            Death Register
          </Tabs.Tab>
          <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
            Statistics
          </Tabs.Tab>
          <Tabs.Tab value="retention" leftSection={<IconShieldCheck size={16} />}>
            Retention Policies
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="records" pt="md">
          <RecordsTab />
        </Tabs.Panel>
        <Tabs.Panel value="case-sheets" pt="md">
          <CaseSheetsTab />
        </Tabs.Panel>
        <Tabs.Panel value="storage" pt="md">
          <StorageLocationsTab />
        </Tabs.Panel>
        <Tabs.Panel value="births" pt="md">
          <BirthsTab />
        </Tabs.Panel>
        <Tabs.Panel value="deaths" pt="md">
          <DeathsTab />
        </Tabs.Panel>
        <Tabs.Panel value="stats" pt="md">
          <StatsTab />
        </Tabs.Panel>
        <Tabs.Panel value="retention" pt="md">
          <RetentionTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Records Tab
// ══════════════════════════════════════════════════════════

function RecordsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.RECORDS_CREATE);
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [issueOpen, { open: openIssue, close: closeIssue }] = useDisclosure();
  const [movementsOpen, { open: openMovements, close: closeMovements }] = useDisclosure();
  const [selectedRecord, setSelectedRecord] = useState<MrdMedicalRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["mrd-records", statusFilter],
    queryFn: () => mrdService.listMrdRecords({ status: statusFilter ?? undefined }),
  });

  // Create
  const [createForm, setCreateForm] = useState<CreateMrdRecordRequest>({ patient_id: "" });
  const createMut = useMutation({
    mutationFn: (body: CreateMrdRecordRequest) => mrdService.createMrdRecord(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeCreate();
      notifications.show({ title: "Created", message: "Medical record indexed", color: "success" });
    },
  });

  // Issue
  const [issueForm, setIssueForm] = useState<IssueMrdRecordRequest>({});
  const issueMut = useMutation({
    mutationFn: (body: IssueMrdRecordRequest) =>
      mrdService.issueMrdRecord(selectedRecord?.id ?? "", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeIssue();
      notifications.show({ title: "Issued", message: "Record issued", color: "success" });
    },
  });

  // Movements
  const { data: movements = [] } = useQuery({
    queryKey: ["mrd-movements", selectedRecord?.id],
    queryFn: () => mrdService.listMrdMovements(selectedRecord?.id ?? ""),
    enabled: movementsOpen && !!selectedRecord,
  });

  const returnMut = useMutation({
    mutationFn: (movementId: string) =>
      mrdService.returnMrdRecord(selectedRecord?.id ?? "", movementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-movements"] });
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      notifications.show({ title: "Returned", message: "Record returned", color: "success" });
    },
  });

  const columns: Column<MrdMedicalRecord>[] = [
    {
      key: "record_number",
      label: "Record #",
      render: (r) => <Text fw={600}>{r.record_number}</Text>,
    },
    {
      key: "record_type",
      label: "Type",
      render: (r) => <Badge variant="light">{r.record_type.toUpperCase()}</Badge>,
    },
    { key: "volume_number", label: "Vol", render: (r) => <Text>{r.volume_number}</Text> },
    {
      key: "shelf_location",
      label: "Shelf",
      render: (r) => <Text>{r.shelf_location ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge color={STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge>,
    },
    {
      key: "last_accessed_at",
      label: "Last Accessed",
      render: (r) => <Text size="sm">{fmt(r.last_accessed_at)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <Tooltip label="Issue">
              <ActionIcon
                variant="light"
                onClick={() => {
                  setSelectedRecord(r);
                  setIssueForm({});
                  openIssue();
                }}
                aria-label="Go forward"
              >
                <IconArrowRight size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Movements">
            <ActionIcon
              variant="light"
              color="primary"
              onClick={() => {
                setSelectedRecord(r);
                openMovements();
              }}
              aria-label="Arrow Back"
            >
              <IconArrowBack size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          data={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "missing", label: "Missing" },
            { value: "destroyed", label: "Destroyed" },
          ]}
          value={statusFilter ?? ""}
          onChange={(v) => setStatusFilter(v || null)}
          placeholder="Filter status"
          w={200}
          clearable
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Index Record
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Index Medical Record"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={createForm.patient_id}
            onChange={(v) => setCreateForm({ ...createForm, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={createForm.patient_id} hideLoadingState />
          <Select
            label="Record Type"
            data={["opd", "ipd", "emergency"]}
            value={createForm.record_type ?? "opd"}
            onChange={(v) => setCreateForm({ ...createForm, record_type: v ?? "opd" })}
          />
          <NumberInput
            label="Volume"
            value={createForm.volume_number ?? 1}
            onChange={(v) => setCreateForm({ ...createForm, volume_number: Number(v) })}
            min={1}
          />
          <Select
            label="Shelf Location"
            placeholder="Select shelf/rack"
            data={MRD_SHELF_OPTIONS}
            value={createForm.shelf_location ?? null}
            onChange={(v) => setCreateForm({ ...createForm, shelf_location: v ?? undefined })}
            searchable
            clearable
          />
          <Select
            label="Filing Method"
            placeholder="Select filing method"
            data={FILING_METHOD_OPTIONS}
            value={createForm.filing_method ?? null}
            onChange={(v) => setCreateForm({ ...createForm, filing_method: v ?? undefined })}
            clearable
          />
          <NumberInput
            label="Total Pages"
            value={createForm.total_pages ?? undefined}
            onChange={(v) =>
              setCreateForm({ ...createForm, total_pages: v ? Number(v) : undefined })
            }
          />
          <Textarea
            label="Notes"
            value={createForm.notes ?? ""}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.currentTarget.value })}
          />
          <Button onClick={() => createMut.mutate(createForm)} loading={createMut.isPending}>
            Create
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Drawer */}
      <Drawer
        opened={issueOpen}
        onClose={closeIssue}
        title={`Issue: ${selectedRecord?.record_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Issued To"
            value={issueForm.issued_to_user_id ?? ""}
            onChange={(id) => setIssueForm({ ...issueForm, issued_to_user_id: id || undefined })}
          />
          <DepartmentSelect
            value={issueForm.issued_to_department_id ?? ""}
            onChange={(id) =>
              setIssueForm({ ...issueForm, issued_to_department_id: id || undefined })
            }
          />
          <TextInput
            label="Purpose"
            value={issueForm.purpose ?? ""}
            onChange={(e) => setIssueForm({ ...issueForm, purpose: e.currentTarget.value })}
          />
          <NumberInput
            label="Due in (days)"
            value={issueForm.due_days ?? 7}
            onChange={(v) => setIssueForm({ ...issueForm, due_days: Number(v) })}
            min={1}
          />
          <Button onClick={() => issueMut.mutate(issueForm)} loading={issueMut.isPending}>
            Issue Record
          </Button>
        </Stack>
      </Drawer>

      {/* Movements Drawer */}
      <Drawer
        opened={movementsOpen}
        onClose={closeMovements}
        title={`Movements: ${selectedRecord?.record_number ?? ""}`}
        position="right"
        size="lg"
      >
        <DataTable
          columns={[
            {
              key: "issued_at",
              label: "Issued",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.issued_at)}</Text>,
            },
            {
              key: "due_date",
              label: "Due",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.due_date)}</Text>,
            },
            {
              key: "returned_at",
              label: "Returned",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.returned_at)}</Text>,
            },
            {
              key: "status",
              label: "Status",
              render: (m: MrdRecordMovement) => (
                <Badge color={STATUS_COLORS[m.status] ?? "slate"}>{m.status}</Badge>
              ),
            },
            {
              key: "purpose",
              label: "Purpose",
              render: (m: MrdRecordMovement) => <Text size="sm">{m.purpose ?? "—"}</Text>,
            },
            {
              key: "action",
              label: "",
              render: (m: MrdRecordMovement) =>
                canManage && m.status === "issued" ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => returnMut.mutate(m.id)}
                    loading={returnMut.isPending}
                  >
                    Return
                  </Button>
                ) : null,
            },
          ]}
          data={movements}
          loading={false}
          rowKey={(m) => m.id}
        />
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Case Sheets Tab
// ══════════════════════════════════════════════════════════

function CaseSheetsTab() {
  const qc = useQueryClient();
  const canPrint = useHasPermission(P.MRD.CASE_SHEETS_PRINT);
  const canReprint = useHasPermission(P.MRD.CASE_SHEETS_REPRINT);
  const canFile = useHasPermission(P.MRD.CASE_SHEETS_FILE);
  const [statusFilter, setStatusFilter] = useState<MrdCaseSheetPacketStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedPacket, setSelectedPacket] = useState<MrdCaseSheetPacket | null>(null);
  const [pagesOpen, { open: openPages, close: closePages }] = useDisclosure();
  const [fileOpen, { open: openFile, close: closeFile }] = useDisclosure();
  const [reprintOpen, { open: openReprint, close: closeReprint }] = useDisclosure();
  const [fileForm, setFileForm] = useState<FileMrdCaseSheetPacketRequest>({
    storage_location_id: "",
  });
  const [reprintReason, setReprintReason] = useState("");

  const { data: packets = [], isLoading } = useQuery({
    queryKey: ["mrd-case-sheets", statusFilter, typeFilter],
    queryFn: () =>
      mrdService.listMrdCaseSheetPackets({
        status: statusFilter ?? undefined,
        packet_type: typeFilter === "opd" || typeFilter === "ipd" ? typeFilter : undefined,
      }),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["mrd-storage-locations"],
    queryFn: () => mrdService.listMrdStorageLocations(),
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["mrd-case-sheet-pages", selectedPacket?.id],
    queryFn: () => mrdService.listMrdCaseSheetPages(selectedPacket?.id ?? ""),
    enabled: pagesOpen && !!selectedPacket,
  });

  const { data: completeness, isLoading: completenessLoading } = useQuery({
    queryKey: ["mrd-case-sheet-completeness", selectedPacket?.id],
    queryFn: () => mrdService.getMrdCaseSheetCompleteness(selectedPacket?.id ?? ""),
    enabled: pagesOpen && !!selectedPacket,
  });

  const printMut = useMutation({
    mutationFn: (packet: MrdCaseSheetPacket) =>
      mrdService.printMrdCaseSheetPacket(packet.id, { copies: 1 }),
    onSuccess: (packet) => {
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-pages", packet.id] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-completeness", packet.id] });
      notifications.show({
        title: "Case sheet printed",
        message: `${packet.packet_number} marked ready for MRD filing`,
        color: "success",
      });
    },
  });

  const reprintMut = useMutation({
    mutationFn: () =>
      mrdService.printMrdCaseSheetPacket(selectedPacket?.id ?? "", {
        copies: 1,
        reprint_reason: reprintReason.trim(),
      }),
    onSuccess: (packet) => {
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-pages", packet.id] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-completeness", packet.id] });
      closeReprint();
      setReprintReason("");
      notifications.show({
        title: "Duplicate printed",
        message: `${packet.packet_number} reprint was logged with reason`,
        color: "success",
      });
    },
  });

  const fileMut = useMutation({
    mutationFn: () => mrdService.fileMrdCaseSheetPacket(selectedPacket?.id ?? "", fileForm),
    onSuccess: (packet) => {
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-completeness", packet.id] });
      void qc.invalidateQueries({ queryKey: ["mrd-storage-locations"] });
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeFile();
      setFileForm({ storage_location_id: "" });
      notifications.show({
        title: "Case sheet filed",
        message: `${packet.packet_number} filed at ${packet.shelf_location ?? "MRD storage"}`,
        color: "success",
      });
    },
  });

  const locationOptions = locations
    .filter((location) => location.is_active)
    .map((location) => ({
      value: location.id,
      label: `${location.code} · ${location.name}`,
    }));

  const columns: Column<MrdCaseSheetPacket>[] = [
    {
      key: "packet_number",
      label: "Packet #",
      render: (packet) => <Text fw={600}>{packet.packet_number}</Text>,
    },
    {
      key: "patient",
      label: "Patient",
      render: (packet) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {packet.patient_name ?? "Patient"}
          </Text>
          <Text size="xs" c="dimmed">
            {packet.uhid ?? "No UHID"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "packet_type",
      label: "Type",
      render: (packet) => <Badge variant="light">{packet.packet_type.toUpperCase()}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (packet) => (
        <Badge color={STATUS_COLORS[packet.status] ?? "slate"}>{packet.status}</Badge>
      ),
    },
    {
      key: "pages",
      label: "Pages",
      render: (packet) => <Text>{packet.page_count}</Text>,
    },
    {
      key: "printed_at",
      label: "Printed",
      render: (packet) => <Text size="sm">{fmt(packet.printed_at)}</Text>,
    },
    {
      key: "shelf_location",
      label: "Shelf",
      render: (packet) => <Text size="sm">{packet.shelf_location ?? "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (packet) => (
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Pages">
            <ActionIcon
              variant="light"
              onClick={() => {
                setSelectedPacket(packet);
                openPages();
              }}
              aria-label="View page checklist"
            >
              <IconClipboardList size={16} />
            </ActionIcon>
          </Tooltip>
          {canPrint && (packet.status === "generated" || packet.status === "draft") && (
            <Tooltip label="Print">
              <ActionIcon
                variant="light"
                color="primary"
                onClick={() => printMut.mutate(packet)}
                loading={printMut.isPending}
                aria-label="Print case sheet"
              >
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canReprint && packet.printed_at && (
            <Tooltip label="Reprint">
              <ActionIcon
                variant="light"
                color="orange"
                onClick={() => {
                  setSelectedPacket(packet);
                  setReprintReason("");
                  openReprint();
                }}
                aria-label="Reprint case sheet"
              >
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canFile && packet.status === "printed" && (
            <Tooltip label="File in MRD">
              <ActionIcon
                variant="light"
                color="success"
                onClick={() => {
                  setSelectedPacket(packet);
                  setFileForm({ storage_location_id: "" });
                  openFile();
                }}
                aria-label="File case sheet"
              >
                <IconMapPin size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select
            data={CASE_SHEET_STATUS_OPTIONS}
            value={statusFilter ?? ""}
            onChange={(value) => setStatusFilter(toCaseSheetStatus(value))}
            w={220}
          />
          <Select
            data={[
              { value: "", label: "All workflows" },
              { value: "opd", label: "OPD" },
              { value: "ipd", label: "IPD" },
            ]}
            value={typeFilter ?? ""}
            onChange={(value) => setTypeFilter(value || null)}
            w={180}
          />
        </Group>
        <Text size="sm" c="dimmed">
          MRD filing follows fixed case-sheet assembly, print control, and storage tracking.
        </Text>
      </Group>

      <DataTable
        columns={columns}
        data={packets}
        loading={isLoading}
        rowKey={(packet) => packet.id}
        emptyIcon={<IconClipboardList size={32} />}
        emptyTitle="No case-sheet packets"
        emptyDescription="Generate an OPD or IPD case sheet from the encounter/admission action panel."
      />

      <Drawer
        opened={pagesOpen}
        onClose={closePages}
        title={`Checklist: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Required pages mirror the MRD assembly order so missing clinical, consent, nursing,
            pharmacy, lab, billing, or discharge pages can be caught before filing.
          </Text>
          <MrdCompletenessPanel completeness={completeness} loading={completenessLoading} />
          <DataTable
            columns={[
              {
                key: "page_order",
                label: "#",
                render: (page: MrdCaseSheetPage) => <Text>{page.page_order}</Text>,
              },
              {
                key: "page_title",
                label: "Page",
                render: (page: MrdCaseSheetPage) => (
                  <Stack gap={0}>
                    <Text fw={500}>{page.page_title}</Text>
                    <Text size="xs" c="dimmed">
                      {page.page_code}
                    </Text>
                  </Stack>
                ),
              },
              {
                key: "source_module",
                label: "Source",
                render: (page: MrdCaseSheetPage) => (
                  <Text size="sm">{page.source_module ?? "manual"}</Text>
                ),
              },
              {
                key: "is_required",
                label: "Required",
                render: (page: MrdCaseSheetPage) =>
                  page.is_required ? (
                    <Badge color="danger">Required</Badge>
                  ) : (
                    <Badge color="slate">Optional</Badge>
                  ),
              },
              {
                key: "status",
                label: "Status",
                render: (page: MrdCaseSheetPage) => (
                  <Badge color={STATUS_COLORS[page.status] ?? "slate"}>{page.status}</Badge>
                ),
              },
            ]}
            data={pages}
            loading={pagesLoading}
            rowKey={(page) => page.id}
          />
        </Stack>
      </Drawer>

      <Drawer
        opened={fileOpen}
        onClose={closeFile}
        title={`File in MRD: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="lg"
      >
        <Stack>
          <Select
            label="Storage Location"
            placeholder="Select rack / shelf / compactor"
            data={locationOptions}
            value={fileForm.storage_location_id}
            onChange={(value) => setFileForm({ ...fileForm, storage_location_id: value ?? "" })}
            required
            searchable
          />
          <Textarea
            label="Filing Notes"
            value={fileForm.notes ?? ""}
            onChange={(event) => setFileForm({ ...fileForm, notes: event.currentTarget.value })}
          />
          <Button
            leftSection={<IconMapPin size={16} />}
            onClick={() => fileMut.mutate()}
            loading={fileMut.isPending}
            disabled={!fileForm.storage_location_id}
          >
            Mark Filed
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={reprintOpen}
        onClose={closeReprint}
        title={`Reprint: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="lg"
      >
        <Stack>
          <Textarea
            label="Reprint Reason"
            description="Duplicate case-sheet prints must keep an MRD audit reason."
            value={reprintReason}
            onChange={(event) => setReprintReason(event.currentTarget.value)}
            minRows={4}
            required
          />
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={() => reprintMut.mutate()}
            loading={reprintMut.isPending}
            disabled={reprintReason.trim().length === 0}
          >
            Print Duplicate
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Storage Locations Tab
// ══════════════════════════════════════════════════════════

function StorageLocationsTab() {
  const qc = useQueryClient();
  const canManageStorage = useHasPermission(P.MRD.STORAGE_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [form, setForm] = useState<CreateMrdStorageLocationRequest>({
    code: "",
    name: "",
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["mrd-storage-locations"],
    queryFn: () => mrdService.listMrdStorageLocations(),
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdStorageLocationRequest) =>
      mrdService.createMrdStorageLocation(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-storage-locations"] });
      closeCreate();
      setForm({ code: "", name: "" });
      notifications.show({
        title: "Location created",
        message: "MRD storage location is available for case-sheet filing",
        color: "success",
      });
    },
  });

  const columns: Column<MrdStorageLocation>[] = [
    {
      key: "code",
      label: "Code",
      render: (location) => <Text fw={600}>{location.code}</Text>,
    },
    {
      key: "name",
      label: "Location",
      render: (location) => (
        <Stack gap={0}>
          <Text fw={500}>{location.name}</Text>
          <Text size="xs" c="dimmed">
            {[location.building, location.floor, location.room, location.rack, location.shelf]
              .filter(Boolean)
              .join(" / ") || "No physical path"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "barcode",
      label: "Barcode",
      render: (location) => <Text size="sm">{location.barcode ?? "—"}</Text>,
    },
    {
      key: "capacity",
      label: "Capacity",
      render: (location) => (
        <Text size="sm">
          {location.current_count}
          {location.capacity ? ` / ${location.capacity}` : ""}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (location) =>
        location.is_active ? (
          <Badge color="success">Active</Badge>
        ) : (
          <Badge color="slate">Closed</Badge>
        ),
    },
    {
      key: "notes",
      label: "Notes",
      render: (location) => <Text size="sm">{location.notes ?? "—"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Configure compactors, racks, shelves, and bins used by MRD filing and retrieval.
        </Text>
        {canManageStorage && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Location
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={locations}
        loading={isLoading}
        rowKey={(location) => location.id}
        emptyIcon={<IconArchive size={32} />}
        emptyTitle="No storage locations"
        emptyDescription="Add MRD compactors, racks, shelves, or bins before filing printed case sheets."
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add MRD Storage Location"
        position="right"
        size="xl"
      >
        <Stack>
          <Group grow>
            <TextInput
              label="Location Code"
              placeholder="MRD-A-01"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
              required
            />
            <TextInput
              label="Name"
              placeholder="Compactor A / Rack 1"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Building"
              value={form.building ?? ""}
              onChange={(event) => setForm({ ...form, building: event.currentTarget.value })}
            />
            <TextInput
              label="Floor"
              value={form.floor ?? ""}
              onChange={(event) => setForm({ ...form, floor: event.currentTarget.value })}
            />
            <TextInput
              label="Room"
              value={form.room ?? ""}
              onChange={(event) => setForm({ ...form, room: event.currentTarget.value })}
            />
            <TextInput
              label="Rack / Compactor"
              value={form.rack ?? ""}
              onChange={(event) => setForm({ ...form, rack: event.currentTarget.value })}
            />
            <TextInput
              label="Shelf"
              value={form.shelf ?? ""}
              onChange={(event) => setForm({ ...form, shelf: event.currentTarget.value })}
            />
            <TextInput
              label="Bin"
              value={form.bin ?? ""}
              onChange={(event) => setForm({ ...form, bin: event.currentTarget.value })}
            />
            <TextInput
              label="Barcode"
              value={form.barcode ?? ""}
              onChange={(event) => setForm({ ...form, barcode: event.currentTarget.value })}
            />
            <NumberInput
              label="Capacity"
              value={form.capacity ?? undefined}
              onChange={(value) =>
                setForm({ ...form, capacity: value ? Number(value) : undefined })
              }
              min={1}
            />
          </SimpleGrid>
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })}
          />
          <Button
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
            disabled={!form.code.trim() || !form.name.trim()}
          >
            Create Location
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Births Tab
// ══════════════════════════════════════════════════════════

function BirthsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.BIRTHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: births = [], isLoading } = useQuery({
    queryKey: ["mrd-births"],
    queryFn: () => mrdService.listMrdBirths(),
  });

  const [form, setForm] = useState<CreateMrdBirthRequest>({
    patient_id: "",
    birth_date: "",
    baby_gender: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdBirthRequest) => mrdService.createMrdBirth(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-births"] });
      closeCreate();
      notifications.show({ title: "Registered", message: "Birth registered", color: "success" });
    },
  });

  const columns: Column<MrdBirthRegister>[] = [
    {
      key: "register_number",
      label: "Reg #",
      render: (r) => <Text fw={600}>{r.register_number}</Text>,
    },
    { key: "birth_date", label: "Date", render: (r) => <Text>{fmt(r.birth_date)}</Text> },
    {
      key: "baby_gender",
      label: "Gender",
      render: (r) => <Badge variant="light">{r.baby_gender}</Badge>,
    },
    {
      key: "baby_weight_grams",
      label: "Weight (g)",
      render: (r) => <Text>{r.baby_weight_grams ?? "—"}</Text>,
    },
    { key: "birth_type", label: "Type", render: (r) => <Text>{r.birth_type}</Text> },
    {
      key: "apgar",
      label: "APGAR",
      render: (r) => <Text>{r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}</Text>,
    },
    {
      key: "cert",
      label: "Certificate",
      render: (r) =>
        r.certificate_issued ? (
          <Badge color="success">Issued</Badge>
        ) : (
          <Badge color="slate">Pending</Badge>
        ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Birth
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={births} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Register Birth"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            label="Mother Patient"
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={form.patient_id} hideLoadingState />
          <TextInput
            label="Birth Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.currentTarget.value })}
          />
          <Select
            label="Baby Gender"
            data={["male", "female", "ambiguous"]}
            required
            value={form.baby_gender}
            onChange={(v) => setForm({ ...form, baby_gender: v ?? "" })}
          />
          <NumberInput
            label="Baby Weight (grams)"
            value={form.baby_weight_grams ?? undefined}
            onChange={(v) => setForm({ ...form, baby_weight_grams: v ? Number(v) : undefined })}
          />
          <Select
            label="Birth Type"
            data={["normal", "cesarean", "assisted", "vacuum", "forceps"]}
            value={form.birth_type ?? "normal"}
            onChange={(v) => setForm({ ...form, birth_type: v ?? "normal" })}
          />
          <Group grow>
            <NumberInput
              label="APGAR 1min"
              value={form.apgar_1min ?? undefined}
              onChange={(v) => setForm({ ...form, apgar_1min: v != null ? Number(v) : undefined })}
              min={0}
              max={10}
            />
            <NumberInput
              label="APGAR 5min"
              value={form.apgar_5min ?? undefined}
              onChange={(v) => setForm({ ...form, apgar_5min: v != null ? Number(v) : undefined })}
              min={0}
              max={10}
            />
          </Group>
          <TextInput
            label="Father Name"
            value={form.father_name ?? ""}
            onChange={(e) => setForm({ ...form, father_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Mother Age"
            value={form.mother_age ?? undefined}
            onChange={(v) => setForm({ ...form, mother_age: v ? Number(v) : undefined })}
          />
          <Textarea
            label="Complications"
            value={form.complications ?? ""}
            onChange={(e) => setForm({ ...form, complications: e.currentTarget.value })}
          />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Deaths Tab
// ══════════════════════════════════════════════════════════

function DeathsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.DEATHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: deaths = [], isLoading } = useQuery({
    queryKey: ["mrd-deaths"],
    queryFn: () => mrdService.listMrdDeaths(),
  });

  const [form, setForm] = useState<CreateMrdDeathRequest>({
    patient_id: "",
    death_date: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdDeathRequest) => mrdService.createMrdDeath(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-deaths"] });
      closeCreate();
      notifications.show({ title: "Registered", message: "Death registered", color: "success" });
    },
  });

  const columns: Column<MrdDeathRegister>[] = [
    {
      key: "register_number",
      label: "Reg #",
      render: (r) => <Text fw={600}>{r.register_number}</Text>,
    },
    { key: "death_date", label: "Date", render: (r) => <Text>{fmt(r.death_date)}</Text> },
    {
      key: "cause_of_death",
      label: "Cause",
      render: (r) => <Text lineClamp={1}>{r.cause_of_death ?? "—"}</Text>,
    },
    {
      key: "manner_of_death",
      label: "Manner",
      render: (r) => <Badge variant="light">{r.manner_of_death}</Badge>,
    },
    {
      key: "is_medico_legal",
      label: "MLC",
      render: (r) =>
        r.is_medico_legal ? <Badge color="danger">MLC</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "cert",
      label: "Certificate",
      render: (r) =>
        r.certificate_issued ? (
          <Badge color="success">Issued</Badge>
        ) : (
          <Badge color="slate">Pending</Badge>
        ),
    },
    {
      key: "municipality",
      label: "Reported",
      render: (r) =>
        r.reported_to_municipality ? (
          <Badge color="success">Yes</Badge>
        ) : (
          <Badge color="orange">No</Badge>
        ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Death
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={deaths} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Register Death"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={form.patient_id} hideLoadingState />
          <TextInput
            label="Death Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.death_date}
            onChange={(e) => setForm({ ...form, death_date: e.currentTarget.value })}
          />
          <TextInput
            label="Cause of Death"
            value={form.cause_of_death ?? ""}
            onChange={(e) => setForm({ ...form, cause_of_death: e.currentTarget.value })}
          />
          <TextInput
            label="Immediate Cause"
            value={form.immediate_cause ?? ""}
            onChange={(e) => setForm({ ...form, immediate_cause: e.currentTarget.value })}
          />
          <TextInput
            label="Antecedent Cause"
            value={form.antecedent_cause ?? ""}
            onChange={(e) => setForm({ ...form, antecedent_cause: e.currentTarget.value })}
          />
          <TextInput
            label="Underlying Cause"
            value={form.underlying_cause ?? ""}
            onChange={(e) => setForm({ ...form, underlying_cause: e.currentTarget.value })}
          />
          <Select
            label="Manner of Death"
            data={["natural", "accident", "suicide", "homicide", "undetermined", "pending"]}
            value={form.manner_of_death ?? "natural"}
            onChange={(v) => setForm({ ...form, manner_of_death: v ?? "natural" })}
          />
          <Group grow>
            <Select
              label="Medico-Legal?"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={String(form.is_medico_legal ?? false)}
              onChange={(v) => setForm({ ...form, is_medico_legal: v === "true" })}
            />
            <Select
              label="Brought Dead?"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={String(form.is_brought_dead ?? false)}
              onChange={(v) => setForm({ ...form, is_brought_dead: v === "true" })}
            />
          </Group>
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Statistics Tab
// ══════════════════════════════════════════════════════════

function StatsTab() {
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const dateParams = {
    from_date: fromDate?.slice(0, 10) ?? undefined,
    to_date: toDate?.slice(0, 10) ?? undefined,
  };

  const { data: morbMort } = useQuery({
    queryKey: ["mrd-morbidity-mortality", dateParams],
    queryFn: () => mrdService.getMrdMorbidityMortality(dateParams),
  });

  const { data: admDisch } = useQuery({
    queryKey: ["mrd-admission-discharge", dateParams],
    queryFn: () => mrdService.getMrdAdmissionDischarge(dateParams),
  });

  return (
    <Stack>
      <Group>
        <DateInput label="From" value={fromDate} onChange={setFromDate} clearable />
        <DateInput label="To" value={toDate} onChange={setToDate} clearable />
      </Group>

      {/* Summary Cards */}
      {admDisch && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Admitted
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.total_admitted}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Discharged
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.total_discharged}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Deaths
            </Text>
            <Text size="xl" fw={700} c="danger">
              {admDisch.total_deaths}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Avg LOS (days)
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.overall_avg_los_days?.toFixed(1) ?? "—"}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Morbidity */}
      <Text fw={600} mt="md">
        Top Morbidity (by ICD-11)
      </Text>
      <DataTable
        columns={[
          {
            key: "icd_code",
            label: "ICD-11 Code",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text>{r.icd_code ?? "—"}</Text>
            ),
          },
          {
            key: "diagnosis_name",
            label: "Diagnosis",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text>{r.diagnosis_name}</Text>
            ),
          },
          {
            key: "count",
            label: "Cases",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text fw={600}>{r.count}</Text>
            ),
          },
        ]}
        data={morbMort?.morbidity ?? []}
        loading={false}
        rowKey={(r) => `${r.icd_code}-${r.diagnosis_name}`}
      />

      {/* Mortality */}
      <Text fw={600} mt="md">
        Top Mortality Causes
      </Text>
      <DataTable
        columns={[
          {
            key: "cause_of_death",
            label: "Cause",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Text>{r.cause_of_death ?? "Unknown"}</Text>
            ),
          },
          {
            key: "manner_of_death",
            label: "Manner",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Badge variant="light">{r.manner_of_death}</Badge>
            ),
          },
          {
            key: "count",
            label: "Deaths",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Text fw={600} c="danger">
                {r.count}
              </Text>
            ),
          },
        ]}
        data={morbMort?.mortality ?? []}
        loading={false}
        rowKey={(r) => `${r.cause_of_death}-${r.manner_of_death}`}
      />

      {/* Department-wise Admission/Discharge */}
      <Text fw={600} mt="md">
        Admission/Discharge by Department
      </Text>
      <DataTable
        columns={[
          {
            key: "department_name",
            label: "Department",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.department_name ?? "Unknown"}</Text>
            ),
          },
          {
            key: "total_admitted",
            label: "Admitted",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.total_admitted}</Text>
            ),
          },
          {
            key: "total_discharged",
            label: "Discharged",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.total_discharged}</Text>
            ),
          },
          {
            key: "total_deaths",
            label: "Deaths",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text c="danger">{r.total_deaths}</Text>
            ),
          },
          {
            key: "avg_los_days",
            label: "Avg LOS",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.avg_los_days?.toFixed(1) ?? "—"}</Text>
            ),
          },
        ]}
        data={admDisch?.rows ?? []}
        loading={false}
        rowKey={(r) => r.department_name ?? "unknown"}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Retention Policies Tab
// ══════════════════════════════════════════════════════════

function RetentionTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["mrd-retention"],
    queryFn: () => mrdService.listMrdRetentionPolicies(),
  });

  const [form, setForm] = useState<CreateMrdRetentionPolicyRequest>({
    record_type: "",
    category: "",
    retention_years: 5,
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdRetentionPolicyRequest) =>
      mrdService.createMrdRetentionPolicy(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-retention"] });
      closeCreate();
      notifications.show({
        title: "Created",
        message: "Retention policy created",
        color: "success",
      });
    },
  });

  const columns: Column<MrdRetentionPolicy>[] = [
    { key: "record_type", label: "Record Type", render: (r) => <Text>{r.record_type}</Text> },
    { key: "category", label: "Category", render: (r) => <Text>{r.category}</Text> },
    {
      key: "retention_years",
      label: "Years",
      render: (r) => <Text fw={600}>{r.retention_years}</Text>,
    },
    {
      key: "legal_reference",
      label: "Legal Ref",
      render: (r) => <Text size="sm">{r.legal_reference ?? "—"}</Text>,
    },
    {
      key: "destruction_method",
      label: "Destruction",
      render: (r) => <Text size="sm">{r.destruction_method ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) =>
        r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Policy
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={policies} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add Retention Policy"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Record Type"
            data={["opd", "ipd", "emergency", "maternity", "mlc", "pediatric"]}
            required
            value={form.record_type}
            onChange={(v) => setForm({ ...form, record_type: v ?? "" })}
          />
          <TextInput
            label="Category"
            required
            placeholder="e.g., adult_opd"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.currentTarget.value })}
          />
          <NumberInput
            label="Retention Years"
            required
            value={form.retention_years}
            onChange={(v) => setForm({ ...form, retention_years: Number(v) })}
            min={1}
          />
          <TextInput
            label="Legal Reference"
            value={form.legal_reference ?? ""}
            onChange={(e) => setForm({ ...form, legal_reference: e.currentTarget.value })}
          />
          <Select
            label="Destruction Method"
            data={["shredding", "incineration"]}
            value={form.destruction_method ?? null}
            onChange={(v) => setForm({ ...form, destruction_method: v ?? undefined })}
            clearable
          />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>
            Create
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
