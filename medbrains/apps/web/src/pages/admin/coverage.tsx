/**
 * Admin: locum / cross-coverage assignments.
 * Per RFCs/sprints/SPRINT-doctor-activities.md §2.2.
 */
import { Group, Modal, Select, Stack, Switch, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash, IconUserCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable, type DataTableFilter } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button, IconButton, Tooltip } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminDoctorsService } from "@/services/adminDoctors.service";

interface CoverageRow {
  id: string;
  absent_doctor_id: string;
  covering_doctor_id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
}

/** Coverage status derived from the assignment window. */
function coverageStatus(row: { start_at: string; end_at: string }): string {
  const now = Date.now();
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  return now < start ? "scheduled" : now > end ? "ended" : "active";
}

export function AdminCoveragePage() {
  useRequirePermission("admin.coverage.list");
  const queryClient = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["admin-coverage", activeOnly],
    queryFn: () => adminDoctorsService.listCoverage({ active_now: activeOnly }),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["admin-doctors-active"],
    queryFn: () => adminDoctorsService.listDoctors({ is_active: true, limit: 500 }),
  });

  const doctorName = (id: string) => {
    const d = doctors.find((x) => x.user_id === id || x.id === id);
    return d ? `${d.prefix ? `${d.prefix} ` : ""}${d.display_name}` : id.slice(0, 8);
  };

  const remove = useMutation({
    mutationFn: (id: string) => adminDoctorsService.deleteCoverage(id),
    onSuccess: () => {
      notifications.show({ title: "Removed", message: "Coverage deleted.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-coverage"] });
    },
  });

  const columns: Column<CoverageRow>[] = [
    {
      key: "absent",
      label: "Absent",
      sortable: true,
      searchable: true,
      accessor: (a) => doctorName(a.absent_doctor_id),
      render: (a) => <Text size="sm">{doctorName(a.absent_doctor_id)}</Text>,
    },
    {
      key: "covering",
      label: "Covering",
      sortable: true,
      searchable: true,
      accessor: (a) => doctorName(a.covering_doctor_id),
      render: (a) => (
        <Text size="sm" fw={500}>
          {doctorName(a.covering_doctor_id)}
        </Text>
      ),
    },
    {
      key: "from",
      label: "From",
      sortable: true,
      sortValue: (a) => new Date(a.start_at).getTime(),
      accessor: (a) => new Date(a.start_at).toLocaleString(),
      render: (a) => <Text size="xs">{new Date(a.start_at).toLocaleString()}</Text>,
    },
    {
      key: "until",
      label: "Until",
      sortable: true,
      sortValue: (a) => new Date(a.end_at).getTime(),
      accessor: (a) => new Date(a.end_at).toLocaleString(),
      render: (a) => <Text size="xs">{new Date(a.end_at).toLocaleString()}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (a) => a.reason ?? "",
      render: (a) => (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {a.reason ?? "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      accessor: (a) => coverageStatus(a),
      render: (a) => (
        <Badge size="xs" tone={statusColor(coverageStatus(a))}>
          {coverageStatus(a)}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (a) => (
        <Tooltip label="Remove">
          <IconButton
            aria-label="Remove coverage"
            tone="danger"
            onClick={() => {
              if (window.confirm("Remove this coverage assignment?")) {
                remove.mutate(a.id);
              }
            }}
          >
            <IconTrash size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const filters: DataTableFilter<CoverageRow>[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "scheduled", label: "Scheduled" },
        { value: "ended", label: "Ended" },
      ],
      matches: (a, value) => coverageStatus(a) === value,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Locum coverage"
        subtitle="Assign covering doctors when one is absent"
        icon={<IconUserCheck size={20} stroke={1.5} />}
        actions={
          <Group gap="xs">
            <Switch
              size="xs"
              label="Active only"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.currentTarget.checked)}
            />
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={createHandlers.open}
            >
              New assignment
            </Button>
          </Group>
        }
      />

      <DataTable<CoverageRow>
        columns={columns}
        data={assignments}
        loading={isLoading}
        rowKey={(a) => a.id}
        searchable
        searchPlaceholder="Search doctor or reason"
        filters={filters}
        exportable
        exportFileName="coverage"
        emptyIcon={<IconUserCheck size={28} stroke={1.5} />}
        emptyTitle="No coverage assignments"
      />

      {createOpen && (
        <CreateCoverageModal
          doctors={doctors.map((d) => ({
            value: d.user_id,
            label: `${d.prefix ? `${d.prefix} ` : ""}${d.display_name}`,
          }))}
          onClose={createHandlers.close}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-coverage"] });
            createHandlers.close();
          }}
        />
      )}
    </div>
  );
}

function CreateCoverageModal({
  doctors,
  onClose,
  onCreated,
}: {
  doctors: { value: string; label: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [absent, setAbsent] = useState<string | null>(null);
  const [covering, setCovering] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!absent || !covering || !start || !end) {
        throw new Error("Select both doctors and a valid date range");
      }
      return adminDoctorsService.createCoverage({
        absent_doctor_id: absent,
        covering_doctor_id: covering,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        reason: reason || null,
      });
    },
    onSuccess: () => {
      notifications.show({ title: "Coverage assigned", message: "Saved.", color: "success" });
      onCreated();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  const canSubmit =
    absent &&
    covering &&
    start &&
    end &&
    absent !== covering &&
    new Date(end).getTime() > new Date(start).getTime();

  return (
    <Modal opened onClose={onClose} title="Assign locum coverage" size="md">
      <Stack gap="sm">
        <Select
          label="Absent doctor"
          data={doctors}
          value={absent}
          onChange={setAbsent}
          searchable
          required
        />
        <Select
          label="Covering doctor"
          data={doctors}
          value={covering}
          onChange={setCovering}
          searchable
          required
        />
        <Group grow>
          <DateTimePicker label="Start" value={start} onChange={setStart} required />
          <DateTimePicker label="End" value={end} onChange={setEnd} required />
        </Group>
        <Textarea
          label="Reason"
          placeholder="Sick leave / annual leave / conference / …"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={create.isPending}
            disabled={!canSubmit}
            onClick={() => create.mutate()}
          >
            Assign
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function statusColor(s: string): BadgeTone {
  switch (s) {
    case "active":
      return "primary";
    case "scheduled":
      return "info";
    case "ended":
      return "neutral";
    default:
      return "neutral";
  }
}
