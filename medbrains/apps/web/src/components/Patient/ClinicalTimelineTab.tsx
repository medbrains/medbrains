import { Anchor, Box, Group, Stack, Text, Timeline } from "@mantine/core";
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
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert, Badge, type BadgeTone, Card } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

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

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClinicalTimelineTab({ patientId }: { patientId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["patient-clinical-timeline", patientId],
    queryFn: () => patientDetailService.getClinicalTimeline(patientId),
  });

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

  return (
    <Card withBorder>
      <Timeline active={-1} bulletSize={28} lineWidth={2}>
        {events.map((e) => {
          const meta = META[e.category];
          const href = linkFor(e);
          return (
            <Timeline.Item key={`${e.category}-${e.ref_id}`} bullet={meta.icon}>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    {href ? (
                      <Anchor component={Link} to={href} size="sm" fw={600}>
                        {e.title}
                      </Anchor>
                    ) : (
                      <Text size="sm" fw={600}>
                        {e.title}
                      </Text>
                    )}
                    <Badge tone={meta.tone} size="sm">
                      {meta.label}
                    </Badge>
                  </Group>
                  {e.subtitle && (
                    <Text size="xs" c="dimmed">
                      {e.subtitle}
                    </Text>
                  )}
                </Stack>
                <Box>
                  <Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                    {formatWhen(e.occurred_at)}
                  </Text>
                </Box>
              </Group>
            </Timeline.Item>
          );
        })}
      </Timeline>
    </Card>
  );
}
