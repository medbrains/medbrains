import { Anchor, Box, Chip, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import type { PatientTimelineEvent } from "@medbrains/types";
import {
  IconAmbulance,
  IconBed,
  IconEye,
  IconFlask,
  IconPill,
  IconReportMedical,
  IconStethoscope,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, type BadgeTone, Card } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import classes from "./clinical-timeline.module.scss";

// Events whose entity has a detail route become clickable; the rest
// (lab/imaging/Rx/diagnosis have no per-entity page) stay plain text.
function linkFor(event: PatientTimelineEvent): string | null {
  switch (event.category) {
    case "opd":
      return `/opd/encounters/${event.ref_id}`;
    case "ipd":
      return `/ipd/admissions/${event.ref_id}`;
    case "emergency":
      return `/emergency/visits/${event.ref_id}`;
    default:
      return null;
  }
}

// Unified clinical timeline — one chronological feed across OPD visits,
// admissions, ER visits, lab + imaging orders and prescriptions. The
// longitudinal EMR view. Reads the patient clinical-timeline endpoint.

const META: Record<
  PatientTimelineEvent["category"],
  { label: string; tone: BadgeTone; icon: ReactNode }
> = {
  opd: { label: "OPD", tone: "primary", icon: <IconStethoscope size={14} /> },
  ipd: { label: "IPD", tone: "info", icon: <IconBed size={14} /> },
  emergency: { label: "Emergency", tone: "danger", icon: <IconAmbulance size={14} /> },
  lab: { label: "Lab", tone: "accent", icon: <IconFlask size={14} /> },
  radiology: { label: "Imaging", tone: "warning", icon: <IconEye size={14} /> },
  pharmacy: { label: "Pharmacy", tone: "success", icon: <IconPill size={14} /> },
  diagnosis: { label: "Diagnosis", tone: "neutral", icon: <IconReportMedical size={14} /> },
};

const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
] as const;

function cutoffFor(range: string): number {
  const months: Record<string, number> = { "3m": 3, "6m": 6, "1y": 12, "2y": 24 };
  const m = months[range];
  if (!m) return Number.NEGATIVE_INFINITY;
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.getTime();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ROW_SIZE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function TimelineNode({ event }: { event: PatientTimelineEvent }) {
  const meta = META[event.category];
  const href = linkFor(event);
  const body = (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap">
          {meta.icon}
          <Badge tone={meta.tone} size="sm">
            {meta.label}
          </Badge>
        </Group>
        <Text size="10px" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>
          {formatWhen(event.occurred_at)}
        </Text>
      </Group>
      <Text size="sm" fw={600} lineClamp={2}>
        {event.title}
      </Text>
      {event.subtitle && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {event.subtitle}
        </Text>
      )}
    </Stack>
  );
  return href ? (
    <Anchor
      component={Link}
      to={href}
      className={`${classes.node} ${classes.nodeLink}`}
      underline="never"
    >
      {body}
    </Anchor>
  ) : (
    <Box className={classes.node}>{body}</Box>
  );
}

export function ClinicalTimelineTab({ patientId }: { patientId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["patient-clinical-timeline", patientId],
    queryFn: () => patientDetailService.getClinicalTimeline(patientId),
  });

  const [range, setRange] = useState<string>("all");
  const [cats, setCats] = useState<string[]>([]);

  const presentCats = useMemo(() => [...new Set(events.map((e) => e.category))], [events]);

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(range);
    return events.filter(
      (e) =>
        new Date(e.occurred_at).getTime() >= cutoff &&
        (cats.length === 0 || cats.includes(e.category)),
    );
  }, [events, range, cats]);

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading clinical timeline…
      </Text>
    );
  }

  if (events.length === 0) {
    return (
      <Alert tone="info">
        No clinical activity recorded yet. Visits, admissions, ER attendances, lab and imaging
        orders, and prescriptions appear here as one chronological record.
      </Alert>
    );
  }

  const rows = chunk(filtered, ROW_SIZE);

  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Chip.Group multiple value={cats} onChange={setCats}>
            <Group gap={6}>
              {presentCats.map((c) => (
                <Chip key={c} value={c} size="xs">
                  {META[c].label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <SegmentedControl
            size="xs"
            value={range}
            onChange={setRange}
            data={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Group>

        {filtered.length === 0 ? (
          <Alert tone="info">No events match the current filters.</Alert>
        ) : (
          <Box className={classes.board}>
            {rows.map((row, rowIdx) => {
              const reverse = rowIdx % 2 === 1;
              const turnSide = rowIdx % 2 === 0 ? classes.right : classes.left;
              return (
                <Box key={`row-${rowIdx}`}>
                  <Box className={reverse ? `${classes.row} ${classes.reverse}` : classes.row}>
                    {row.map((e, i) => (
                      <Fragment key={`${e.category}-${e.ref_id}`}>
                        <TimelineNode event={e} />
                        {i < row.length - 1 && <Box className={classes.hconn} />}
                      </Fragment>
                    ))}
                  </Box>
                  {rowIdx < rows.length - 1 && (
                    <Box className={`${classes.turnRow} ${turnSide}`}>
                      <Box className={classes.vconn} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Stack>
    </Card>
  );
}
