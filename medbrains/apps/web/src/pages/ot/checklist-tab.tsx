// IPD ChecklistTab — split from ot.tsx (pure move).

import { Card, Checkbox, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  ChecklistPhase,
  CreateSafetyChecklistRequest,
  OtSurgicalSafetyChecklist,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCircleCheck, IconCircleDashed } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { otService } from "@/services/ot.service";

interface WhoChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

const PHASES: ChecklistPhase[] = ["sign_in", "time_out", "sign_out"];

const phaseLabels: Record<ChecklistPhase, string> = {
  sign_in: "Sign In",
  time_out: "Time Out",
  sign_out: "Sign Out",
};

function previousChecklistPhase(phase: ChecklistPhase): ChecklistPhase | null {
  const index = PHASES.indexOf(phase);
  if (index <= 0) {
    return null;
  }

  return PHASES[index - 1] ?? null;
}

function readChecklistItems(checklist: OtSurgicalSafetyChecklist): WhoChecklistItem[] {
  return Array.isArray(checklist.items) ? (checklist.items as WhoChecklistItem[]) : [];
}

function PhaseChecklistBody({
  bookingId,
  checklist,
  canEdit,
}: {
  bookingId: string;
  checklist: OtSurgicalSafetyChecklist;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<WhoChecklistItem[]>(() => readChecklistItems(checklist));

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });

  const save = useMutation({
    mutationFn: (next: WhoChecklistItem[]) =>
      otService.updateSafetyChecklist(bookingId, checklist.id, { items: next }),
    onError: () => toast.error("Failed to save checklist", { title: "Error" }),
  });

  const complete = useMutation({
    mutationFn: () =>
      otService.updateSafetyChecklist(bookingId, checklist.id, { items, completed: true }),
    onSuccess: () => {
      invalidate();
      toast.success("Phase completed", { title: "Completed" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Cannot complete" }),
  });

  const toggle = (key: string) => {
    const next = items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i));
    setItems(next);
    save.mutate(next);
  };

  const allChecked = items.length > 0 && items.every((i) => i.checked);

  return (
    <Stack gap="xs" mt="xs">
      {items.map((item) => (
        <Checkbox
          key={item.key}
          label={item.label}
          checked={item.checked}
          disabled={!canEdit}
          onChange={() => toggle(item.key)}
          size="xs"
        />
      ))}
      {canEdit && (
        <Button
          tone="primary"
          size="xs"
          mt="xs"
          disabled={!allChecked}
          loading={complete.isPending}
          onClick={() => complete.mutate()}
        >
          {allChecked ? "Mark Complete" : "Check all items to complete"}
        </Button>
      )}
    </Stack>
  );
}

export function ChecklistTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.SAFETY_CHECKLIST_CREATE);

  const { data: checklists = [], isLoading } = useQuery<OtSurgicalSafetyChecklist[]>({
    queryKey: ["ot-checklists", bookingId],
    queryFn: () => otService.listSafetyChecklists(bookingId),
  });

  const byPhase = new Map(checklists.map((c) => [c.phase, c]));

  const createMutation = useMutation({
    mutationFn: (d: CreateSafetyChecklistRequest) => otService.createSafetyChecklist(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });
      toast.success("Checklist phase started", { title: "Created" });
    },
    onError: () => toast.error("Failed to create checklist", { title: "Error" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const isPhaseBlocked = (phase: ChecklistPhase): boolean => {
    const prevPhase = previousChecklistPhase(phase);
    if (!prevPhase) {
      return false;
    }
    const prev = byPhase.get(prevPhase);
    return !prev?.completed;
  };

  return (
    <Stack>
      <Text fw={600}>WHO Surgical Safety Checklist</Text>
      {PHASES.map((phase) => {
        const checklist = byPhase.get(phase);
        const blocked = isPhaseBlocked(phase);
        const completed = checklist?.completed ?? false;
        const previousPhase = previousChecklistPhase(phase);

        return (
          <Card
            key={phase}
            withBorder
            padding="sm"
            style={{
              borderColor: completed
                ? "var(--mantine-color-green-5)"
                : checklist
                  ? "var(--mantine-color-yellow-5)"
                  : undefined,
            }}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon
                  size="sm"
                  variant="light"
                  color={completed ? "success" : checklist ? "warning" : "slate"}
                >
                  {completed ? <IconCircleCheck size={14} /> : <IconCircleDashed size={14} />}
                </ThemeIcon>
                <Text fw={500}>{phaseLabels[phase]}</Text>
              </Group>
              {completed && (
                <Badge tone="success" size="sm">
                  Completed
                </Badge>
              )}
              {checklist && !completed && (
                <Badge tone="warning" size="sm">
                  In Progress
                </Badge>
              )}
              {!checklist && (
                <Badge tone="neutral" size="sm">
                  Not Started
                </Badge>
              )}
            </Group>

            {checklist && (
              <PhaseChecklistBody
                bookingId={bookingId}
                checklist={checklist}
                canEdit={canCreate && !completed}
              />
            )}

            {checklist?.completed_at && (
              <Text size="xs" c="dimmed" mt={4}>
                Completed at: {new Date(checklist.completed_at).toLocaleString()}
              </Text>
            )}

            {canCreate && !checklist && (
              <Button
                tone="secondary"
                size="xs"
                mt="xs"
                disabled={blocked}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate({ phase, items: [] })}
              >
                {blocked
                  ? `Complete ${previousPhase ? phaseLabels[previousPhase] : "previous phase"} first`
                  : `Start ${phaseLabels[phase]}`}
              </Button>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}
