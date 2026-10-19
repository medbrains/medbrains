/**
 * One checklist, worked through: the hospital enters its criteria (pasted,
 * one per line, from its own copy of the standard), records a finding
 * against each, and sees the score the server computes from them.
 */
import { Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ComplianceChecklistItem, ComplianceChecklistStatus } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Drawer, IconButton, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { ChecklistItemModal, type CriterionAssessment } from "./checklist-item-modal";
import { CRITERION_STATUSES, checklistStatusColors } from "./shared";

interface ChecklistDetailDrawerProps {
  checklistId: string | null;
  onClose: () => void;
}

const STATUS_LABEL = new Map(CRITERION_STATUSES.map((s) => [s.value, s.label]));

export function ChecklistDetailDrawer({ checklistId, onClose }: ChecklistDetailDrawerProps) {
  const canUpdate = useHasPermission(P.REGULATORY.CHECKLISTS_UPDATE);
  const qc = useQueryClient();
  const [pasted, setPasted] = useState("");
  const [editing, setEditing] = useState<{
    item: ComplianceChecklistItem;
    status?: ComplianceChecklistStatus;
  } | null>(null);
  const id = checklistId ?? "";
  const checklist = useQuery({
    queryKey: ["regulatory-checklist", id],
    queryFn: () => regulatoryService.getChecklist(id),
    enabled: Boolean(checklistId),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["regulatory-checklist", id] });
    void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
  };
  const items = checklist.data?.items ?? [];
  const criteria = useMemo(
    () =>
      pasted
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [pasted],
  );

  const add = useMutation({
    mutationFn: () => {
      const next = items.reduce((max, i) => Math.max(max, i.item_number), 0);
      return regulatoryService.batchChecklistItems(
        id,
        criteria.map((criterion, i) => ({
          item_number: next + i + 1,
          criterion,
          status: "not_started",
        })),
      );
    },
    onSuccess: (rows) => {
      toast.success(`${rows.length} criteria added`);
      setPasted("");
      refresh();
    },
  });
  const assess = useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: Partial<CriterionAssessment> }) =>
      regulatoryService.updateChecklistItem(id, itemId, {
        ...values,
        status: values.status as ComplianceChecklistStatus | undefined,
        target_date: values.target_date || undefined,
      }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => regulatoryService.deleteChecklistItem(id, itemId),
    onSuccess: refresh,
  });
  // A non-compliant finding needs its gap and action, so it opens the form.
  const chooseStatus = (item: ComplianceChecklistItem, status: ComplianceChecklistStatus) =>
    status === "non_compliant"
      ? setEditing({ item, status })
      : assess.mutate({ itemId: item.id, values: { status } });

  const c = checklist.data;
  return (
    <Drawer
      opened={Boolean(checklistId)}
      onClose={onClose}
      title={c?.name ?? "Checklist"}
      position="right"
      size="xl"
    >
      <Stack gap="md">
        {c && (
          <Group gap="sm">
            <Badge tone="neutral" tt="uppercase">
              {c.accreditation_body}
            </Badge>
            <Text size="sm">
              {c.standard_code} · {c.assessment_period_start} — {c.assessment_period_end}
            </Text>
            <Badge tone={checklistStatusColors[c.overall_status]}>
              {STATUS_LABEL.get(c.overall_status) ?? c.overall_status}
            </Badge>
            <Text size="sm" fw={600} data-testid="checklist-score">
              {c.compliance_score != null
                ? `Score ${Number(c.compliance_score)}%`
                : "Not scored yet"}
            </Text>
            <Text size="sm" c="dimmed">
              {c.compliant_items} compliant · {c.non_compliant_items} not compliant ·{" "}
              {c.total_items} criteria
            </Text>
          </Group>
        )}
        {canUpdate && (
          <Stack gap="xs">
            <Textarea
              label="Add criteria"
              description="One per line, from your copy of the standard"
              autosize
              minRows={3}
              value={pasted}
              onChange={(e) => {
                const { value } = e.currentTarget;
                setPasted(value);
              }}
            />
            <Group>
              <Button
                tone="secondary"
                disabled={criteria.length === 0}
                loading={add.isPending}
                onClick={() => add.mutate()}
              >
                {criteria.length > 0 ? `Add ${criteria.length} criteria` : "Add criteria"}
              </Button>
            </Group>
          </Stack>
        )}
        {(assess.isError || remove.isError) && (
          <Alert tone="danger">{(assess.error ?? remove.error)?.message}</Alert>
        )}
        <DataTable
          data={items}
          loading={checklist.isLoading}
          error={checklist.error}
          onRetry={() => void checklist.refetch()}
          rowKey={(r) => r.id}
          emptyTitle="No criteria yet"
          emptyDescription="Paste the criteria of this standard above, one per line."
          columns={[
            {
              key: "item_number",
              label: "#",
              render: (r) => <Text size="sm">{r.item_number}</Text>,
            },
            {
              key: "criterion",
              label: "Criterion",
              render: (r) => <Text size="sm">{r.criterion}</Text>,
            },
            {
              key: "status",
              label: "Finding",
              render: (r) =>
                canUpdate ? (
                  <Select
                    aria-label={`Finding for criterion ${r.item_number}`}
                    size="xs"
                    data={CRITERION_STATUSES}
                    value={r.status}
                    allowDeselect={false}
                    onChange={(v) => v && chooseStatus(r, v as ComplianceChecklistStatus)}
                  />
                ) : (
                  <Badge tone={checklistStatusColors[r.status]}>{STATUS_LABEL.get(r.status)}</Badge>
                ),
            },
            {
              key: "gap",
              label: "Gap and action",
              render: (r) => (
                <Text size="sm" c={r.gap_description ? undefined : "dimmed"}>
                  {r.gap_description ? `${r.gap_description} → ${r.corrective_action ?? "—"}` : "—"}
                  {r.target_date ? ` (by ${r.target_date})` : ""}
                </Text>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (r) =>
                canUpdate ? (
                  <Group gap={4} wrap="nowrap">
                    <IconButton
                      aria-label={`Assess criterion ${r.item_number}`}
                      tone="default"
                      onClick={() => setEditing({ item: r })}
                    >
                      <IconPencil size={16} />
                    </IconButton>
                    <IconButton
                      aria-label={`Remove criterion ${r.item_number}`}
                      tone="danger"
                      loading={remove.isPending && remove.variables === r.id}
                      onClick={() => remove.mutate(r.id)}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Group>
                ) : null,
            },
          ]}
        />
      </Stack>
      <ChecklistItemModal
        item={editing?.item ?? null}
        status={editing?.status}
        saving={assess.isPending}
        error={assess.error}
        onSave={(values) => editing && assess.mutate({ itemId: editing.item.id, values })}
        onClose={() => setEditing(null)}
      />
    </Drawer>
  );
}
