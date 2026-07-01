import { Group, Loader, Menu, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { TeleConsultation } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBrandGoogle,
  IconCalendarPlus,
  IconDownload,
  IconPhoneOff,
  IconPlayerPlay,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { telemedicineService } from "@/services/telemedicine.service";
import { type CalendarEvent, downloadIcs, googleCalendarUrl } from "@/utils/calendar";

const PROVIDER_OPTIONS = [
  { value: "jitsi", label: "Jitsi (auto room)" },
  { value: "external", label: "External link (paste)" },
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Microsoft Teams" },
] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: "info",
  waiting: "warning",
  in_progress: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

const QUERY_KEY = ["tele-consultations"] as const;

interface CreateForm {
  patient_id: string;
  provider: string;
  meeting_url: string;
  scheduled_at: string;
}

const EMPTY_FORM: CreateForm = {
  patient_id: "",
  provider: "jitsi",
  meeting_url: "",
  scheduled_at: "",
};

export function TelemedicinePage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const queryClient = useQueryClient();
  const [modalOpen, modal] = useDisclosure(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const {
    data: consults = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => telemedicineService.listTeleConsultations(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: () =>
      telemedicineService.createTeleConsultation({
        patient_id: form.patient_id.trim(),
        provider: form.provider,
        meeting_url: form.meeting_url.trim() || undefined,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      }),
    onSuccess: () => {
      void invalidate();
      modal.close();
      setForm(EMPTY_FORM);
      notifications.show({
        title: "Consultation created",
        message: "Tele-consult scheduled.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      telemedicineService.updateTeleStatus(id, { status }),
    onSuccess: () => void invalidate(),
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "danger" }),
  });

  const join = async (c: TeleConsultation) => {
    try {
      const info = await telemedicineService.getTeleJoinInfo(c.id);
      if (!info.join_url) {
        notifications.show({
          title: "Not ready",
          message: "The meeting link is still being created — try again shortly.",
          color: "warning",
        });
        return;
      }
      window.open(info.join_url, "_blank", "noopener");
      if (c.status === "scheduled" || c.status === "waiting") {
        statusMutation.mutate({ id: c.id, status: "in_progress" });
      }
    } catch (err) {
      notifications.show({
        title: "Join failed",
        message: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    }
  };

  const calendarEvent = async (c: TeleConsultation): Promise<CalendarEvent | null> => {
    try {
      const info = await telemedicineService.getTeleJoinInfo(c.id);
      return {
        title: "Tele-consultation",
        description: `Video consultation (${c.provider}).`,
        url: info.join_url,
        start: c.scheduled_at ? new Date(c.scheduled_at) : new Date(),
        durationMinutes: 30,
      };
    } catch {
      notifications.show({
        title: "Calendar",
        message: "Couldn't build the calendar event — the meeting link may not be ready.",
        color: "danger",
      });
      return null;
    }
  };

  const addToIcs = async (c: TeleConsultation) => {
    const event = await calendarEvent(c);
    if (event) downloadIcs(event, `tele-${c.id.slice(0, 8)}.ics`);
  };

  const addToGoogle = async (c: TeleConsultation) => {
    const event = await calendarEvent(c);
    if (event) window.open(googleCalendarUrl(event), "_blank", "noopener");
  };

  const submit = () => {
    if (!form.patient_id.trim()) {
      notifications.show({
        title: "Patient required",
        message: "Enter a patient id.",
        color: "danger",
      });
      return;
    }
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading consultations…</Text>
      </Stack>
    );
  }
  if (isError) {
    return (
      <Text c="danger" p="md">
        Failed to load tele-consultations.
      </Text>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <IconVideo size={22} />
            <Text fw={700} size="xl">
              Telemedicine
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            Video consultations — Jitsi, an external link, or a connected provider (Zoom).
          </Text>
        </div>
        {canCreate && (
          <Button tone="primary" leftSection={<IconCalendarPlus size={16} />} onClick={modal.open}>
            New consultation
          </Button>
        )}
      </Group>

      {consults.length > 0 ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Scheduled</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={180}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {consults.map((c) => {
              const closed = ["completed", "cancelled", "no_show"].includes(c.status);
              return (
                <Table.Tr key={c.id}>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {c.patient_id.slice(0, 8)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone="info" size="sm">
                      {c.provider}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("en-IN") : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={STATUS_TONE[c.status] ?? "neutral"} size="sm">
                      {c.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {!closed && (
                        <Button
                          tone="primary"
                          size="compact-xs"
                          leftSection={<IconVideo size={14} />}
                          onClick={() => void join(c)}
                        >
                          Join
                        </Button>
                      )}
                      {!closed && (
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <IconButton tone="default" size="sm" aria-label="Add to calendar">
                              <IconCalendarPlus size={14} />
                            </IconButton>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconDownload size={14} />}
                              onClick={() => void addToIcs(c)}
                            >
                              Download .ics
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconBrandGoogle size={14} />}
                              onClick={() => void addToGoogle(c)}
                            >
                              Add to Google Calendar
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
                      {canUpdate && c.status === "in_progress" && (
                        <IconButton
                          tone="success"
                          size="sm"
                          aria-label="Complete"
                          onClick={() => statusMutation.mutate({ id: c.id, status: "completed" })}
                        >
                          <IconPlayerPlay size={14} />
                        </IconButton>
                      )}
                      {canUpdate && !closed && (
                        <IconButton
                          tone="danger"
                          size="sm"
                          aria-label="Cancel"
                          onClick={() => statusMutation.mutate({ id: c.id, status: "cancelled" })}
                        >
                          <IconX size={14} />
                        </IconButton>
                      )}
                      {c.status === "completed" && (
                        <IconPhoneOff size={14} color="var(--mb-text-secondary)" />
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Stack align="center" py="xl" gap="xs">
          <IconVideo size={32} color="var(--mb-text-secondary)" />
          <Text c="dimmed">No tele-consultations yet.</Text>
        </Stack>
      )}

      <Modal opened={modalOpen} onClose={modal.close} title="New tele-consultation" size="md">
        <Stack gap="md">
          <PatientSearchSelect
            label="Patient"
            required
            value={form.patient_id}
            onChange={(patientId) => setForm({ ...form, patient_id: patientId })}
          />
          <Select
            label="Provider"
            data={[...PROVIDER_OPTIONS]}
            value={form.provider}
            onChange={(v) => setForm({ ...form, provider: v ?? "jitsi" })}
            allowDeselect={false}
          />
          {form.provider === "external" && (
            <TextInput
              label="Meeting link"
              placeholder="https://… (Zoom / Meet / Teams)"
              value={form.meeting_url}
              onChange={(e) => setForm({ ...form, meeting_url: e.currentTarget.value })}
            />
          )}
          <TextInput
            label="Scheduled at"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={modal.close}>
              Cancel
            </Button>
            <Button tone="primary" loading={createMutation.isPending} onClick={submit}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
