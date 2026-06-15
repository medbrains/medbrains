import {
  ActionIcon,
  Card,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

interface HolidayEntry {
  date: string;
  name: string;
  recurring?: boolean;
}

interface NumberSettingDef {
  key: string;
  category: string;
  label: string;
  description: string;
  fallback: number;
}

const NUMBER_SETTINGS: NumberSettingDef[] = [
  {
    key: "appointment_slot_duration_mins",
    category: "operations",
    label: "Default slot duration (minutes)",
    description: "Used when a doctor schedule does not set its own slot length.",
    fallback: 15,
  },
  {
    key: "appointment_slot_capacity",
    category: "operations",
    label: "Default patients per slot",
    description: "Slot capacity when a doctor schedule does not override it.",
    fallback: 1,
  },
  {
    key: "appointment_max_patients",
    category: "operations",
    label: "Default max patients per schedule",
    description: "Daily cap applied to newly created doctor schedules.",
    fallback: 20,
  },
  {
    key: "visitor_pass_valid_hours",
    category: "operations",
    label: "Visitor pass validity (hours)",
    description: "Default validity for front-office visitor passes.",
    fallback: 2,
  },
  {
    key: "max_visitors_per_patient",
    category: "operations",
    label: "Max visitors per patient",
    description: "Default for new visiting-hours rules.",
    fallback: 2,
  },
  {
    key: "token_days",
    category: "retention",
    label: "Token retention (days)",
    description: "Expired event tokens are purged after this window.",
    fallback: 30,
  },
  {
    key: "otp_days",
    category: "retention",
    label: "OTP retention (days)",
    description: "Used password-reset/booking OTPs are purged after this window.",
    fallback: 7,
  },
  {
    key: "outbox_days",
    category: "retention",
    label: "Outbox event retention (days)",
    description: "Delivered notification events are purged after this window.",
    fallback: 90,
  },
  {
    key: "dlq_days",
    category: "retention",
    label: "Dead-letter retention (days)",
    description: "Failed outbox events kept for review, then purged.",
    fallback: 90,
  },
  {
    key: "job_days",
    category: "retention",
    label: "Job history retention (days)",
    description: "Completed and dead-lettered integration jobs are purged after this window.",
    fallback: 30,
  },
  {
    key: "camp_sync_days",
    category: "retention",
    label: "Camp sync event retention (days)",
    description: "Settled camp sync events (applied/duplicate) are purged after this window.",
    fallback: 60,
  },
];

function settingNumber(rows: { key: string; value: unknown }[] | undefined, key: string) {
  const raw = rows?.find((row) => row.key === key)?.value;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
}

function NumberSettingRow({
  def,
  current,
  onSave,
  saving,
}: {
  def: NumberSettingDef;
  current: number | null;
  onSave: (value: number) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<number | string>(current ?? def.fallback);

  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={0} style={{ flex: 1 }}>
        <Text size="sm" fw={600}>
          {def.label}
        </Text>
        <Text size="xs" c="dimmed">
          {def.description}
        </Text>
      </Stack>
      <Group gap="xs" wrap="nowrap">
        <NumberInput value={draft} onChange={setDraft} min={1} w={110} size="xs" />
        <Button
          tone="secondary"
          size="xs"
          loading={saving}
          disabled={typeof draft !== "number" || draft === current}
          onClick={() => typeof draft === "number" && onSave(draft)}
        >
          Save
        </Button>
      </Group>
    </Group>
  );
}

function HolidaysCard({
  holidays,
  onSave,
  saving,
}: {
  holidays: HolidayEntry[];
  onSave: (next: HolidayEntry[]) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [recurring, setRecurring] = useState(false);

  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name.trim()) return;
    onSave([...holidays, { date, name: name.trim(), recurring: recurring || undefined }]);
    setDate("");
    setName("");
    setRecurring(false);
  };

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Stack gap={0}>
          <Title order={6}>Hospital holidays</Title>
          <Text size="xs" c="dimmed">
            No appointment slots are offered on these dates unless a doctor has an explicit
            availability exception. Recurring holidays repeat every year.
          </Text>
        </Stack>
        {holidays.length > 0 && (
          <Table withTableBorder={false} verticalSpacing={4}>
            <Table.Tbody>
              {holidays.map((holiday, index) => (
                <Table.Tr key={`${holiday.date}-${holiday.name}`}>
                  <Table.Td w={120}>
                    <Text size="sm" ff="monospace">
                      {holiday.date}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{holiday.name}</Text>
                  </Table.Td>
                  <Table.Td w={90}>
                    {holiday.recurring && (
                      <Text size="xs" c="dimmed">
                        yearly
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td w={40}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="danger"
                      aria-label="Remove holiday"
                      onClick={() => onSave(holidays.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Group gap="xs" align="flex-end">
          <TextInput
            label="Date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
            w={140}
            size="xs"
          />
          <TextInput
            label="Name"
            placeholder="Republic Day"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 1 }}
            size="xs"
          />
          <Checkbox
            label="Yearly"
            checked={recurring}
            onChange={(e) => setRecurring(e.currentTarget.checked)}
            size="xs"
            mb={6}
          />
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            loading={saving}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name.trim()}
            onClick={addHoliday}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function OperationsSettings() {
  const queryClient = useQueryClient();

  const { data: operationsRows, isLoading: operationsLoading } = useQuery({
    queryKey: ["tenant-settings", "operations"],
    queryFn: () => tenantSettingsService.getTenantSettings("operations"),
    staleTime: 60_000,
  });
  const { data: retentionRows, isLoading: retentionLoading } = useQuery({
    queryKey: ["tenant-settings", "retention"],
    queryFn: () => tenantSettingsService.getTenantSettings("retention"),
    staleTime: 60_000,
  });

  const holidays = useMemo<HolidayEntry[]>(() => {
    const raw = operationsRows?.find((row) => row.key === "holidays")?.value;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (entry): entry is HolidayEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as HolidayEntry).date === "string" &&
        typeof (entry as HolidayEntry).name === "string",
    );
  }, [operationsRows]);

  const saveMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: unknown }) =>
      tenantSettingsService.updateTenantSetting(data),
    onSuccess: (_result, variables) => {
      notifications.show({
        title: "Setting saved",
        message: `${variables.key.replace(/_/g, " ")} updated`,
        color: "success",
        icon: <IconCheck size={16} />,
        autoClose: 2000,
      });
      void queryClient.invalidateQueries({
        queryKey: ["tenant-settings", variables.category],
      });
    },
  });

  if (operationsLoading || retentionLoading) {
    return <Loader size="sm" />;
  }

  const rowsFor = (category: string) => (category === "retention" ? retentionRows : operationsRows);

  return (
    <Stack gap="md">
      <Card withBorder>
        <Stack gap="sm">
          <Stack gap={0}>
            <Title order={6}>Operational defaults</Title>
            <Text size="xs" c="dimmed">
              Backend behaviour reads these values live; leave unset to keep system defaults.
            </Text>
          </Stack>
          {NUMBER_SETTINGS.map((def) => (
            <NumberSettingRow
              key={`${def.category}.${def.key}`}
              def={def}
              current={settingNumber(rowsFor(def.category), def.key)}
              saving={saveMutation.isPending}
              onSave={(value) =>
                saveMutation.mutate({ category: def.category, key: def.key, value })
              }
            />
          ))}
        </Stack>
      </Card>
      <HolidaysCard
        holidays={holidays}
        saving={saveMutation.isPending}
        onSave={(next) =>
          saveMutation.mutate({ category: "operations", key: "holidays", value: next })
        }
      />
    </Stack>
  );
}
