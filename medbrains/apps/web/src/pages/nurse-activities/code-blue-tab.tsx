// IPD CodeBlueTab — split from nurse-activities.tsx (pure move).

import { Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { type CodeBlueResponder, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  const canRespond = useHasPermission(P.NURSE.CODE_BLUE_RESPOND);
  const me = useAuthStore((s) => s.user?.id);
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
  const hasActive = (data?.length ?? 0) > 0;
  // Who is coming, for every active arrest, in one call. Polls only while an
  // arrest is in progress: the list is meaningless otherwise.
  const { data: responders = [] } = useQuery({
    queryKey: ["code-blue", "responders"],
    queryFn: () => nurseActivitiesService.listCodeBlueResponders(),
    enabled: canView && hasActive,
    refetchInterval: hasActive ? 5000 : false,
  });
  const respondersByEvent = useMemo(() => {
    const byEvent = new Map<string, CodeBlueResponder[]>();
    for (const r of responders) {
      const list = byEvent.get(r.code_blue_id);
      if (list) list.push(r);
      else byEvent.set(r.code_blue_id, [r]);
    }
    return byEvent;
  }, [responders]);

  const respond = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.respondToCodeBlue(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["code-blue", "responders"] });
    },
    onError: (err: Error) => toast.error(err.message),
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
                <Group gap="xs">
                  {canRespond && (
                    <Button
                      tone={
                        respondersByEvent.get(row.id)?.some((r) => r.user_id === me)
                          ? "subtle-danger"
                          : "danger"
                      }
                      disabled={respondersByEvent.get(row.id)?.some((r) => r.user_id === me)}
                      onClick={() => respond.mutate(row.id)}
                      loading={respond.isPending}
                    >
                      {respondersByEvent.get(row.id)?.some((r) => r.user_id === me)
                        ? "You are responding"
                        : "Responding"}
                    </Button>
                  )}
                  {canRecord && (
                    <Button
                      tone="danger"
                      onClick={() => end.mutate(row.id)}
                      loading={end.isPending}
                    >
                      End event
                    </Button>
                  )}
                </Group>
              </Group>
              <ResponderRoll responders={respondersByEvent.get(row.id) ?? []} />
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

/**
 * Who has answered this arrest, in the order they answered. The first name
 * is the team's arrival — the number NABH asks for — so it is set apart.
 *
 * An empty roll says so in words. A page that nobody has answered yet is the
 * most important state this list has, and it must not look like a blank.
 */
function ResponderRoll({ responders }: { responders: CodeBlueResponder[] }) {
  const first = responders[0];
  if (!first) {
    return (
      <Text size="sm" c="dimmed" mt="sm">
        Nobody has responded yet.
      </Text>
    );
  }
  const rest = responders.slice(1);
  return (
    <Stack gap={4} mt="sm">
      <Group gap="xs">
        <Badge tone="success">First on scene</Badge>
        <Text size="sm" fw={600}>
          {first.user_name}
        </Text>
        <Text size="sm" c="dimmed">
          +{first.seconds_after_call}s
        </Text>
      </Group>
      {rest.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="sm" c="dimmed">
            Also responding:
          </Text>
          {rest.map((r) => (
            <Text key={r.user_id} size="sm">
              {r.user_name}{" "}
              <Text span c="dimmed">
                +{r.seconds_after_call}s
              </Text>
            </Text>
          ))}
        </Group>
      )}
    </Stack>
  );
}
