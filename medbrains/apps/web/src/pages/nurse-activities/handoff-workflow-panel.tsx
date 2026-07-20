// IPD HandoffWorkflowPanel — split from nurse-activities.tsx (pure move).

import { Card, Group, Select, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { SetupUser } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import { compactId, EncounterContextField, encounterLocked } from "./shared";

interface ShiftHandoffRow {
  id: string;
  encounter_id: string;
  outgoing_nurse_id: string;
  incoming_nurse_id: string;
  outgoing_signed_at?: string | null;
  incoming_signed_at?: string | null;
  situation?: string | null;
  background?: string | null;
  assessment?: string | null;
  recommendation?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export function HandoffWorkflowPanel({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.HANDOFF_VIEW);
  const canRecord = useHasPermission(P.NURSE.HANDOFF_RECORD);
  const canListUsers = useHasPermission(P.ADMIN.USERS.LIST);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const [incomingNurseId, setIncomingNurseId] = useState("");
  const [situation, setSituation] = useState("");
  const [background, setBackground] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["handoff-nurse-users"],
    queryFn: () => adminAccessService.listUsers(),
    enabled: canListUsers,
    staleTime: 300_000,
  });
  const nurseUsers = (users as SetupUser[]).filter((user) => {
    const role = user.role.toLowerCase();
    return user.is_active && (role.includes("nurse") || role.includes("matron"));
  });
  const incomingOptions = (nurseUsers.length > 0 ? nurseUsers : (users as SetupUser[]))
    .filter((user) => user.is_active)
    .map((user) => ({
      value: user.id,
      label: `${user.full_name} · ${user.role}`,
    }));

  const { data: handoffs = [], isLoading } = useQuery({
    queryKey: ["nurse-handoffs", encounterId],
    queryFn: () =>
      nurseActivitiesService.listHandoffsForEncounter(encounterId) as Promise<ShiftHandoffRow[]>,
    enabled: canView && encounterId.length > 0,
  });

  const createHandoff = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createHandoff({
        encounter_id: encounterId,
        incoming_nurse_id: incomingNurseId,
        situation: situation.trim() || undefined,
        background: background.trim() || undefined,
        assessment: assessment.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
        alerts: [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nurse-handoffs"] });
      setIncomingNurseId("");
      setSituation("");
      setBackground("");
      setAssessment("");
      setRecommendation("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create handoff" }),
  });

  const acceptHandoff = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.acceptHandoff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-handoffs"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not accept handoff" }),
  });

  return (
    <Card withBorder padding="md">
      <Stack>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={700}>Patient Handoff</Text>
            <Text size="xs" c="dimmed">
              Transfer bedside responsibility to the incoming nurse using SBAR.
            </Text>
          </Stack>
          {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
        </Group>

        <Group align="end">
          <EncounterContextField
            value={encounterId}
            onChange={setEncounterId}
            locked={isLinkedEncounter}
            patientId={patientId}
          />
          <Select
            label="Incoming nurse"
            placeholder={canListUsers ? "Select receiving nurse" : "Roster picker unavailable"}
            data={incomingOptions}
            value={incomingNurseId || null}
            onChange={(value) => setIncomingNurseId(value ?? "")}
            searchable
            disabled={!canRecord || !canListUsers}
            w={320}
          />
        </Group>

        {!canListUsers && (
          <Text size="xs" c="dimmed">
            The final handoff picker should come from the shift roster. Until that route exists,
            users with staff-list permission can choose the incoming nurse here.
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Textarea
            label="Situation"
            value={situation}
            onChange={(event) => setSituation(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Background"
            value={background}
            onChange={(event) => setBackground(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Assessment"
            value={assessment}
            onChange={(event) => setAssessment(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.currentTarget.value)}
            minRows={2}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button
            tone="primary"
            onClick={() => createHandoff.mutate()}
            loading={createHandoff.isPending}
            disabled={!encounterId || !incomingNurseId || !canRecord}
          >
            Sign handoff
          </Button>
        </Group>

        {canView ? (
          <>
            {isLoading && <Text c="dimmed">Loading handoffs...</Text>}
            <Stack gap="xs">
              {handoffs.map((row) => (
                <Card key={row.id} withBorder padding="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Badge tone={row.completed_at ? "success" : "warning"}>
                          {row.completed_at ? "Accepted" : "Awaiting incoming nurse"}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          To {compactId(row.incoming_nurse_id)}
                        </Text>
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.situation || "No situation entered"}
                      </Text>
                      {row.recommendation && (
                        <Text size="xs" c="dimmed">
                          Recommendation: {row.recommendation}
                        </Text>
                      )}
                    </Stack>
                    {!row.completed_at && canRecord && (
                      <Button
                        tone="secondary"
                        size="xs"
                        onClick={() => acceptHandoff.mutate(row.id)}
                        loading={acceptHandoff.isPending}
                      >
                        Accept
                      </Button>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            You can sign handoffs, but handoff history requires handoff view permission.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ── Code Blue Tab ───────────────────────────────────────────────────

/** Nurse-draft prescription writer — Rx-only items route to a doctor to countersign. */
