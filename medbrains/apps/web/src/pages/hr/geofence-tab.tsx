// HR GeofenceTab — where staff may clock in from: each campus's fence and
// what the hospital does with a punch from outside it (#4850).

import { Stack, Text } from "@mantine/core";
import type { CampusFence, GeofenceMode } from "@medbrains/types";
import { IconEdit } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, SegmentedControl, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { CampusFenceModal } from "./campus-fence-modal";

const QK = ["hr-geofence"];

const MODES: { value: GeofenceMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "flag", label: "Flag for HR" },
  { value: "block", label: "Block" },
];

const MODE_HELP: Record<GeofenceMode, string> = {
  off: "The location is kept with each punch, but nothing is flagged or refused.",
  flag: "Every punch is accepted. A punch from outside the fence, with no location, or with an uncertain location is marked for HR on the attendance list.",
  block:
    "A punch from outside the fence, or with location access turned off, is refused with a message saying why. An uncertain location is flagged, never refused.",
};

function coords(c: CampusFence): string {
  return c.latitude === null || c.longitude === null
    ? "Not set"
    : `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
}

export function GeofenceTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CampusFence | null>(null);
  const settings = useQuery({ queryKey: QK, queryFn: () => hrService.getGeofenceSettings() });

  const setMode = useMutation({
    mutationFn: (mode: GeofenceMode) => hrService.setGeofenceMode(mode),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK });
      toast.success("Geofence mode saved", { title: "Geofence" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Mode not saved" }),
  });

  const mode = settings.data?.mode;

  return (
    <Stack gap="md">
      <Alert tone="info" title="How the geofence works">
        Each campus is a circle: its location and a radius. When staff start or end a shift, their
        device's location is checked against the nearest fenced campus. A location less accurate
        than the fence radius is treated as uncertain. Campuses without a fence are not checked.
      </Alert>

      <Stack gap={4}>
        <Text size="sm" fw={600} id="geofence-mode-label">
          When a punch is not on site
        </Text>
        <SegmentedControl
          aria-labelledby="geofence-mode-label"
          data={MODES}
          value={mode ?? ""}
          disabled={!mode || setMode.isPending}
          onChange={(v) => setMode.mutate(v as GeofenceMode)}
        />
        {mode && (
          <Text size="sm" c="dimmed">
            {MODE_HELP[mode]}
          </Text>
        )}
      </Stack>

      <DataTable
        data={settings.data?.campuses ?? []}
        loading={settings.isLoading}
        error={settings.error}
        onRetry={() => void settings.refetch()}
        emptyTitle="No campuses"
        emptyDescription="Add the hospital's campuses in setup first."
        rowKey={(c: CampusFence) => c.id}
        columns={[
          {
            key: "name",
            label: "Campus",
            render: (c: CampusFence) => (
              <Text size="sm">
                {c.name}{" "}
                <Text span size="xs" c="dimmed" ff="monospace">
                  {c.code}
                </Text>
              </Text>
            ),
          },
          {
            key: "location",
            label: "Location",
            render: (c: CampusFence) => (
              <Text size="sm" ff="monospace">
                {coords(c)}
              </Text>
            ),
          },
          {
            key: "fence",
            label: "Fence",
            render: (c: CampusFence) =>
              c.geofence_radius_m === null ? (
                <Badge size="sm" tone="neutral">
                  No fence
                </Badge>
              ) : (
                <Badge size="sm" tone="success">
                  {c.geofence_radius_m} m
                </Badge>
              ),
          },
          {
            key: "actions",
            label: "",
            render: (c: CampusFence) => (
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconEdit size={16} />}
                onClick={() => setEditing(c)}
              >
                Set fence
              </Button>
            ),
          },
        ]}
      />

      {editing && <CampusFenceModal campus={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
