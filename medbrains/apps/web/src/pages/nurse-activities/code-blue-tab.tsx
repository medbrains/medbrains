// IPD CodeBlueTab — split from nurse-activities.tsx (pure move).

import { Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import { compactId } from "./shared";

interface CodeBlueRow {
  id: string;
  patient_id: string;
  location: string;
  started_at: string;
  ended_at?: string | null;
  outcome?: string | null;
}

export function CodeBlueTab({
  patientId,
  encounterId,
  wardId,
  bedId,
}: {
  patientId: string;
  encounterId: string;
  wardId: string;
  bedId: string;
}) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.CODE_BLUE_VIEW);
  const canRecord = useHasPermission(P.NURSE.CODE_BLUE_RECORD);
  const linkedLocation = [
    wardId ? `Ward ${compactId(wardId)}` : "",
    bedId ? `Bed ${compactId(bedId)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const [location, setLocation] = useState(linkedLocation);
  const effectiveLocation = linkedLocation || location.trim();
  const { data } = useQuery({
    queryKey: ["code-blue", "active"],
    queryFn: () =>
      nurseActivitiesService.listCodeBlue({ active_only: true }) as Promise<CodeBlueRow[]>,
    enabled: canView,
    refetchInterval: canView ? 5000 : false,
  });

  const start = useMutation({
    mutationFn: () =>
      nurseActivitiesService.startCodeBlue({
        patient_id: patientId,
        encounter_id: encounterId || undefined,
        location: effectiveLocation,
      }),
    onSuccess: () => {
      if (!linkedLocation) {
        setLocation("");
      }
      qc.invalidateQueries({ queryKey: ["code-blue"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not start code blue" }),
  });

  const end = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.endCodeBlue(id, { outcome: "stable" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code-blue"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not end code blue" }),
  });

  return (
    <Stack>
      {canRecord && (
        <Card withBorder padding="md">
          <Group align="end">
            {linkedLocation ? (
              <Card withBorder padding="sm">
                <Text size="xs" c="dimmed">
                  Code blue location
                </Text>
                <Text size="sm" fw={700}>
                  {linkedLocation}
                </Text>
              </Card>
            ) : (
              <TextInput
                label="Location"
                value={location}
                onChange={(event) => setLocation(event.currentTarget.value)}
                placeholder="ICU bed 4, ward 2 bed 10"
                w={320}
              />
            )}
            <Button
              tone="danger"
              onClick={() => start.mutate()}
              loading={start.isPending}
              disabled={!patientId || !effectiveLocation}
            >
              Start code blue
            </Button>
          </Group>
          {!patientId && (
            <Text size="xs" c="dimmed" mt="xs">
              Open from an admission or patient context before starting a code blue.
            </Text>
          )}
        </Card>
      )}
      {canView ? (
        <>
          {data?.length === 0 && <Text c="dimmed">No active code blue events.</Text>}
          {data?.map((row) => (
            <Card key={row.id} withBorder padding="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Badge tone="danger">ACTIVE</Badge>
                    <Text fw={600}>{row.location}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Started {new Date(row.started_at).toLocaleTimeString()}
                  </Text>
                </Stack>
                {canRecord && (
                  <Button tone="danger" onClick={() => end.mutate(row.id)} loading={end.isPending}>
                    End event
                  </Button>
                )}
              </Group>
            </Card>
          ))}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          You can start code blue, but active event monitoring requires code-blue view permission.
        </Text>
      )}
    </Stack>
  );
}
