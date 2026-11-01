// The leave calendar shared by HR → Calendar and Profile → My time off. Presentational:
// the caller fetches the window this view reports and decides who may click what.

import { Group, Skeleton, Stack, Text, UnstyledButton } from "@mantine/core";
import "@mantine/schedule/styles.css";
import { DayView, MonthView, type ScheduleEventData, WeekView } from "@mantine/schedule";
import {
  IconBabyCarriage,
  IconBeach,
  IconCalendarStar,
  IconChevronLeft,
  IconChevronRight,
  IconClockPlus,
  IconCoinOff,
  IconFirstAidKit,
  IconSchool,
  IconStar,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { type ComponentType, useMemo, useState } from "react";
import { Alert, Button, IconButton, SegmentedControl } from "@/components/ui";
import {
  type CalendarView,
  isPendingLeave,
  type LeaveRow,
  stepDate,
  toLeaveEvents,
  visibleRange,
} from "./leave-calendar";
import styles from "./leave-calendar.module.scss";

interface LeaveCalendarViewProps<T extends LeaveRow> {
  window: LeaveCalendarWindow;
  rows: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Omit when the viewer may not request leave — days are then not actionable. */
  onDayClick?: (day: string) => void;
  onLeaveClick: (leave: T) => void;
  /** The server capped the list; some leave in this window is not drawn. */
  isTruncated?: boolean;
}

const TYPE_ICON: Record<string, ComponentType<{ size?: number }>> = {
  casual: IconBeach,
  earned: IconCalendarStar,
  medical: IconFirstAidKit,
  maternity: IconBabyCarriage,
  paternity: IconBabyCarriage,
  compensatory: IconClockPlus,
  study: IconSchool,
  special: IconStar,
  loss_of_pay: IconCoinOff,
};

const VIEW_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export interface LeaveCalendarWindow {
  view: CalendarView;
  date: string;
  from: string;
  to: string;
  setView: (v: CalendarView) => void;
  setDate: (d: string) => void;
}

/** View + anchor date, and the window they cover — the query key for the caller. */
export function useLeaveCalendarWindow(initial: CalendarView = "month"): LeaveCalendarWindow {
  const [view, setView] = useState<CalendarView>(initial);
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const range = useMemo(() => visibleRange(view, date), [view, date]);
  return { view, date, setView, setDate, ...range };
}

function windowTitle({ view, date, from, to }: LeaveCalendarWindow): string {
  if (view === "day") return dayjs(date).format("dddd D MMMM YYYY");
  if (view === "month") return dayjs(date).format("MMMM YYYY");
  return `${dayjs(from).format("D MMM")} – ${dayjs(to).format("D MMM YYYY")}`;
}

function EventBody(event: ScheduleEventData) {
  const leave = (event.payload as { leave: LeaveRow }).leave;
  const Icon = TYPE_ICON[leave.leave_type] ?? IconCalendarStar;
  return (
    <Group gap={4} wrap="nowrap" className={styles.eventBody}>
      <Icon size={16} aria-hidden />
      <Text size="xs" truncate>
        {event.title}
      </Text>
    </Group>
  );
}

/** Pending leave draws a dashed border, approved a solid one — shape, not only colour. */
function renderEvent(event: ScheduleEventData, props: React.ComponentPropsWithoutRef<"button">) {
  const leave = (event.payload as { leave: LeaveRow }).leave;
  return (
    <UnstyledButton
      {...props}
      data-leave-state={isPendingLeave(leave.status) ? "pending" : "approved"}
      aria-label={`${isPendingLeave(leave.status) ? "" : "Approved · "}${event.title}, ${leave.start_date} to ${leave.end_date}`}
    />
  );
}

export function LeaveCalendarView<T extends LeaveRow>({
  window: w,
  rows,
  isLoading,
  error,
  onRetry,
  onDayClick,
  onLeaveClick,
  isTruncated,
}: LeaveCalendarViewProps<T>) {
  const events = useMemo(() => toLeaveEvents(rows ?? []), [rows]);
  const shared = {
    date: w.date,
    onDateChange: w.setDate,
    events,
    withHeader: false,
    firstDayOfWeek: 1 as const,
    renderEventBody: EventBody,
    renderEvent,
    onEventClick: (e: ScheduleEventData) => onLeaveClick((e.payload as { leave: T }).leave),
  };
  const onSlot =
    onDayClick && (({ slotStart }: { slotStart: string }) => onDayClick(slotStart.slice(0, 10)));

  let body: React.ReactNode;
  if (error) {
    // An outage must never read as "nobody is on leave".
    body = (
      <Alert tone="danger" title="Leave could not be loaded">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">{error.message}</Text>
          <Button tone="secondary" onClick={onRetry}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  } else if (isLoading) {
    body = <Skeleton height={480} aria-label="Loading leave" />;
  } else if (w.view === "month") {
    body = <MonthView {...shared} onDayClick={onDayClick} maxEventsPerDay={3} />;
  } else if (w.view === "week") {
    body = (
      <WeekView
        {...shared}
        startTime="09:00:00"
        endTime="17:00:00"
        withCurrentTimeIndicator={false}
        onAllDaySlotClick={onDayClick}
        onTimeSlotClick={onSlot}
      />
    );
  } else {
    body = (
      <DayView
        {...shared}
        startTime="09:00:00"
        endTime="17:00:00"
        withCurrentTimeIndicator={false}
        onAllDaySlotClick={onDayClick}
        onTimeSlotClick={onSlot}
      />
    );
  }

  return (
    <Stack gap="sm" className={styles.root}>
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Button tone="secondary" onClick={() => w.setDate(dayjs().format("YYYY-MM-DD"))}>
            Today
          </Button>
          <IconButton
            aria-label={`Previous ${w.view}`}
            onClick={() => w.setDate(stepDate(w.view, w.date, -1))}
          >
            <IconChevronLeft size={16} />
          </IconButton>
          <IconButton
            aria-label={`Next ${w.view}`}
            onClick={() => w.setDate(stepDate(w.view, w.date, 1))}
          >
            <IconChevronRight size={16} />
          </IconButton>
          <Text fw={600} aria-live="polite">
            {windowTitle(w)}
          </Text>
        </Group>
        <SegmentedControl
          aria-label="Calendar view"
          value={w.view}
          onChange={(v) => w.setView(v as CalendarView)}
          data={VIEW_OPTIONS}
        />
      </Group>
      {body}
      {!error && !isLoading && events.length === 0 && (
        <Text size="sm" c="dimmed">
          No leave in this period
          {onDayClick ? ". Choose a day to request leave." : "."}
        </Text>
      )}
      {isTruncated && (
        <Alert tone="warning" title="Not all leave is shown">
          This period has more leave than one page holds. Narrow it with the department or staff
          filter, or switch to the week view.
        </Alert>
      )}
      <Text size="xs" c="dimmed">
        Solid border: approved · Dashed border: pending
      </Text>
    </Stack>
  );
}
