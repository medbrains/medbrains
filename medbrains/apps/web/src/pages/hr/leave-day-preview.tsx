// The days a leave would take, as the server counts them — shown live in the request form.
// Holidays in the range are listed with an icon and words, never colour alone.

import { Group, Skeleton, Stack, Text } from "@mantine/core";
import type { LeaveDayCount } from "@medbrains/types";
import { IconFlag } from "@tabler/icons-react";
import type { UseQueryResult } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Alert } from "@/components/ui";
import { holidayLabel } from "./leave-calendar";

interface LeaveDayPreviewProps {
  query: UseQueryResult<LeaveDayCount, Error>;
}

function daysLine(c: LeaveDayCount): string {
  const n = Number(c.days);
  const unit = c.counts_calendar_days ? "calendar day" : "working day";
  const line = `Takes ${n} ${unit}${n === 1 ? "" : "s"}`;
  return c.counts_calendar_days ? `${line} — maternity leave counts every day` : line;
}

export function LeaveDayPreview({ query }: LeaveDayPreviewProps) {
  if (query.isError) {
    return (
      <Alert tone="danger" title="Leave days could not be counted">
        {query.error.message}
      </Alert>
    );
  }
  if (query.isLoading) return <Skeleton height={20} aria-label="Counting leave days" />;
  if (!query.data) return null;
  const c = query.data;
  return (
    <Stack gap={4} aria-live="polite">
      <Text size="sm" fw={600}>
        {daysLine(c)}
      </Text>
      {c.holidays.map((h) => (
        <Group key={h.id} gap={4} wrap="nowrap">
          <IconFlag size={16} aria-hidden />
          <Text size="sm">
            {holidayLabel(h)}, {dayjs(h.holiday_date).format("D MMM")}
            {h.kind === "restricted" && !c.counts_calendar_days
              ? " — counted as a working day"
              : ""}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
