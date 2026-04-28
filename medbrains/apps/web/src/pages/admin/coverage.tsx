/**
 * Admin: locum / cross-coverage assignments.
 * Per RFCs/sprints/SPRINT-doctor-activities.md §2.2.
 */
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { IconPlus, IconTrash, IconUserCheck } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function AdminCoveragePage() {
  useRequirePermission("admin.coverage.list");
  const queryClient = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["admin-coverage", activeOnly],
    queryFn: () => api.adminListCoverage({ active_now: activeOnly }),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["admin-doctors-active"],
    queryFn: () => api.adminListDoctors({ is_active: true, limit: 500 }),
  });

  const doctorName = (id: string) => {
    const d = doctors.find((x) => x.user_id === id || x.id === id);
    return d ? `${d.prefix ? `${d.prefix} ` : ""}${d.display_name}` : id.slice(0, 8);
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteCoverage(id),
    onSuccess: () => {
      notifications.show({ title: "Removed", message: "Coverage deleted.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-coverage"] });
    },
  });

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
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={createHandlers.open}>
              New assignment
            </Button>
          </Group>
        }
      />

      <Card padding={0} withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Absent</Table.Th>
              <Table.Th>Covering</Table.Th>
              <Table.Th>From</Table.Th>
              <Table.Th>Until</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {assignments.map((a) => {
              const now = Date.now();
              const start = new Date(a.start_at).getTime();
              const end = new Date(a.end_at).getTime();
              const status =
                now < start ? "scheduled" : now > end ? "ended" : "active";
              return (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Text size="sm">{doctorName(a.absent_doctor_id)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{doctorName(a.covering_doctor_id)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(a.start_at).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(a.end_at).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={1}>{a.reason ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={statusColor(status)}>{status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Remove">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          if (window.confirm("Remove this coverage assignment?")) {
                            remove.mutate(a.id);
                          }
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {!isLoading && assignments.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    No coverage assignments.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

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
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.adminCreateCoverage({
        absent_doctor_id: absent!,
        covering_doctor_id: covering!,
        start_at: start!.toISOString(),
        end_at: end!.toISOString(),
        reason: reason || null,
      }),
    onSuccess: () => {
      notifications.show({ title: "Coverage assigned", message: "Saved.", color: "success" });
      onCreated();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  const canSubmit =
    absent && covering && start && end && absent !== covering && end > start;

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
          <DateTimePicker
            label="Start"
            value={start}
            onChange={(v) => setStart(v as unknown as Date | null)}
            required
          />
          <DateTimePicker
            label="End"
            value={end}
            onChange={(v) => setEnd(v as unknown as Date | null)}
            required
          />
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
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
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

function statusColor(s: string): string {
  switch (s) {
    case "active": return "primary";
    case "scheduled": return "info";
    case "ended": return "gray";
    default: return "gray";
  }
}
