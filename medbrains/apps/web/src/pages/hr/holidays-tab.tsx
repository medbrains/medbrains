// HR → Holidays: the hospital's holidays for a year and its weekly offs. Leave days are
// counted from these on the server. Rendered only for `hr.holiday.manage` holders.

import { Group, Stack, Text } from "@mantine/core";
import type { Holiday } from "@medbrains/types";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Chip, ChipGroup, IconButton, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { hrService } from "@/services/hr.service";
import { HolidayModal } from "./holiday-modal";
import { useHolidays } from "./leave-calendar-view";

/** `0` = Sunday … `6` = Saturday, as the server stores weekly offs. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const KIND_LABEL: Record<Holiday["kind"], string> = {
  national: "National",
  regional: "Regional",
  restricted: "Restricted (optional)",
};

export function HolidaysTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(() => dayjs().year());
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const calendar = useHolidays(`${year}-01-01`, `${year}-12-31`);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["hr-holidays"] });

  const setOffs = useMutation({
    mutationFn: (days: number[]) => hrService.setWeeklyOffs(days),
    onSuccess: () => {
      invalidate();
      toast.success("Leave requested from now on is counted with them.", {
        title: "Weekly offs saved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Weekly offs not saved" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => hrService.deleteHoliday(id),
    onSuccess: () => {
      invalidate();
      toast.warning("Leave already requested keeps its days.", { title: "Holiday removed" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Holiday not removed" }),
  });

  const offs = calendar.data?.weekly_offs;

  return (
    <Stack gap="md">
      <Alert tone="info" title="How leave days are counted">
        Leave is counted in working days: weekly offs and national or regional holidays are not
        counted. A restricted holiday is optional, so it counts as a working day. Maternity leave
        counts every calendar day. Changes apply to leave requested from now on.
      </Alert>

      <Stack gap={4}>
        <Text size="sm" fw={600} id="weekly-offs-label">
          Weekly offs
        </Text>
        <ChipGroup
          multiple
          value={(offs ?? []).map(String)}
          onChange={(v) => setOffs.mutate(v.map(Number))}
        >
          <Group gap="xs" role="group" aria-labelledby="weekly-offs-label">
            {WEEKDAYS.map((day, i) => (
              <Chip key={day} value={String(i)} disabled={!offs || setOffs.isPending}>
                {day}
              </Chip>
            ))}
          </Group>
        </ChipGroup>
      </Stack>

      <Group justify="space-between">
        <Group gap="xs">
          <IconButton aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
            <IconChevronLeft size={16} />
          </IconButton>
          <Text fw={600} aria-live="polite">
            Holidays {year}
          </Text>
          <IconButton aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
            <IconChevronRight size={16} />
          </IconButton>
        </Group>
        <Button
          tone="primary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditing("new")}
        >
          Add holiday
        </Button>
      </Group>

      <DataTable
        data={calendar.data?.holidays ?? []}
        loading={calendar.isLoading}
        error={calendar.error}
        onRetry={() => void calendar.refetch()}
        emptyTitle={`No holidays for ${year}`}
        emptyDescription="Add the hospital's holidays so leave over them is not counted."
        rowKey={(h: Holiday) => h.id}
        columns={[
          {
            key: "date",
            label: "Date",
            render: (h: Holiday) => (
              <Text size="sm">{dayjs(h.holiday_date).format("ddd D MMM YYYY")}</Text>
            ),
          },
          {
            key: "name",
            label: "Holiday",
            render: (h: Holiday) => <Text size="sm">{h.name}</Text>,
          },
          {
            key: "kind",
            label: "Kind",
            render: (h: Holiday) => (
              <Badge size="sm" tone={h.kind === "restricted" ? "neutral" : "warning"}>
                {KIND_LABEL[h.kind]}
              </Badge>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (h: Holiday) => (
              <Group gap={4} wrap="nowrap">
                <IconButton aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}>
                  <IconEdit size={16} />
                </IconButton>
                <IconButton
                  tone="danger"
                  aria-label={`Remove ${h.name}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    confirmDestructive({
                      title: "Remove holiday",
                      message: `Remove ${h.name} on ${dayjs(h.holiday_date).format("D MMM YYYY")}? Leave requested from now on will count that day.`,
                      confirmLabel: "Remove holiday",
                      onConfirm: () => remove.mutate(h.id),
                    })
                  }
                >
                  <IconTrash size={16} />
                </IconButton>
              </Group>
            ),
          },
        ]}
      />

      {editing && (
        <HolidayModal
          holiday={editing === "new" ? undefined : editing}
          defaultDate={`${year}-01-01`}
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  );
}
