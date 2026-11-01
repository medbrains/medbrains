/**
 * Draft a change set: pick the area, stage additions, changes and removals
 * against the live rows, give a reason, then save and preview its impact.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type {
  KnowledgeArea,
  KnowledgeChangeItem,
  KnowledgeChangeOp,
  KnowledgeLiveRow,
  KnowledgeRowFields,
} from "@medbrains/types";
import { IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { type UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Card,
  IconButton,
  Input,
  Select,
  Table,
  TextArea,
  toast,
} from "@/components/ui";
import { knowledgeChangesService as svc } from "@/services/knowledgeChanges.service";
import { DiffTable } from "./diff-table";
import { AREA_LABEL, OP_LABEL, rowTitle } from "./labels";
import { RowForm } from "./row-form";

export interface EditorPrefill {
  area: KnowledgeArea;
  op: KnowledgeChangeOp;
  target: string | null;
}

interface Staged {
  op: KnowledgeChangeOp;
  target_id: string | null;
  after: KnowledgeRowFields | null;
}

interface EditorProps {
  areas: KnowledgeArea[];
  prefill: EditorPrefill | null;
  onCreated: (id: string) => void;
  onCancel: () => void;
}

const metaSchema = z.object({
  title: z.string().trim().min(1, "Give the change a title"),
  reason: z.string().trim().min(1, "Say why this change is needed"),
});

type Editing = { target_id: string | null } | null;

function initialStaged(prefill: EditorPrefill | null): Staged[] {
  return prefill?.op === "delete" && prefill.target
    ? [{ op: "delete", target_id: prefill.target, after: null }]
    : [];
}

function initialEditing(prefill: EditorPrefill | null): Editing {
  if (prefill?.op === "create") return { target_id: null };
  if (prefill?.op === "update" && prefill.target) return { target_id: prefill.target };
  return null;
}

export function Editor({ areas, prefill, onCreated, onCancel }: EditorProps) {
  const [area, setArea] = useState<KnowledgeArea>(prefill?.area ?? areas[0] ?? "drug_interactions");
  const [staged, setStaged] = useState<Staged[]>(() => initialStaged(prefill));
  const [editing, setEditing] = useState<Editing>(() => initialEditing(prefill));
  const rows = useQuery({
    queryKey: ["knowledge-changes", "rows", area],
    queryFn: () => svc.liveRows(area),
  });
  const live = useMemo(() => new Map((rows.data ?? []).map((r) => [r.id, r.fields])), [rows.data]);
  const meta = useForm({
    resolver: zodResolver(metaSchema),
    defaultValues: { title: "", reason: "" },
  });

  const save = useMutation({
    mutationFn: async (values: z.infer<typeof metaSchema>) => {
      const created = await svc.create({ area, ...values, items: staged });
      // Preview straight away. If measuring fails the draft is kept and the
      // failure said out loud: it must never read as "no impact".
      try {
        await svc.preview(created.id);
      } catch (e) {
        toast.warning(
          `Saved as a draft, but its impact could not be measured (${(e as Error).message}). Open it and preview again.`,
        );
      }
      return created.id;
    },
    onSuccess: onCreated,
  });

  const stagedTargets = new Set(staged.map((s) => s.target_id).filter(Boolean));
  const preview: KnowledgeChangeItem[] = staged.map((s, i) => ({
    id: `${i}`,
    seq: i + 1,
    op: s.op,
    target_kind: area,
    target_key: s.target_id,
    before: s.target_id ? (live.get(s.target_id) ?? null) : null,
    after: s.after,
  }));
  const stage = (item: Staged) => {
    setStaged((prev) => [...prev, item]);
    setEditing(null);
  };

  return (
    <Stack gap="md">
      <Select
        label="Area"
        data={areas.map((a) => ({ value: a, label: AREA_LABEL[a] }))}
        value={area}
        disabled={staged.length > 0}
        description={staged.length > 0 ? "One area per change." : undefined}
        onChange={(v) => v && setArea(v as KnowledgeArea)}
        allowDeselect={false}
      />
      <LiveRows
        area={area}
        rows={rows}
        staged={stagedTargets}
        onEdit={(id) => setEditing({ target_id: id })}
        onRemove={(id) => stage({ op: "delete", target_id: id, after: null })}
      />
      {editing ? (
        <Card padding="md" withBorder>
          <Text fw={600} mb="xs">
            {editing.target_id ? "Change rule" : "New rule"}
          </Text>
          {editing.target_id && !live.has(editing.target_id) ? (
            <Text size="sm" c="dimmed">
              Loading the rule…
            </Text>
          ) : (
            <RowForm
              area={area}
              initial={editing.target_id ? (live.get(editing.target_id) ?? null) : null}
              onCancel={() => setEditing(null)}
              onSave={(after) =>
                stage({
                  op: editing.target_id ? "update" : "create",
                  target_id: editing.target_id,
                  after,
                })
              }
            />
          )}
        </Card>
      ) : (
        <Group>
          <Button
            tone="secondary"
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditing({ target_id: null })}
          >
            Add a rule
          </Button>
        </Group>
      )}
      {staged.length > 0 && (
        <Stack gap="xs">
          <Text fw={600}>In this change ({staged.length})</Text>
          {preview.map((p, i) => (
            <Group key={p.id} gap="xs">
              <Text size="sm">
                {p.seq}. {OP_LABEL[p.op]}: {rowTitle(area, p.after ?? p.before)}
              </Text>
              <IconButton
                tone="default"
                size="sm"
                aria-label={`Take item ${p.seq} out of this change`}
                onClick={() => setStaged((prev) => prev.filter((_, j) => j !== i))}
              >
                <IconX size={16} />
              </IconButton>
            </Group>
          ))}
          <DiffTable area={area} items={preview} />
        </Stack>
      )}
      <Stack component="form" gap="sm" onSubmit={meta.handleSubmit((v) => save.mutate(v))}>
        <Controller
          control={meta.control}
          name="title"
          render={({ field, fieldState }) => (
            <Input label="Title" required error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={meta.control}
          name="reason"
          render={({ field, fieldState }) => (
            <TextArea
              label="Reason"
              required
              autosize
              minRows={2}
              error={fieldState.error?.message}
              {...field}
            />
          )}
        />
        {save.error && (
          <Alert tone="danger" role="alert">
            {save.error.message}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            tone="primary"
            type="submit"
            loading={save.isPending}
            disabled={staged.length === 0}
          >
            Save and preview impact
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}

interface LiveRowsProps {
  area: KnowledgeArea;
  rows: UseQueryResult<KnowledgeLiveRow[]>;
  staged: Set<string | null>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

function LiveRows({ area, rows, staged, onEdit, onRemove }: LiveRowsProps) {
  if (rows.error) {
    return (
      <Alert tone="danger" role="alert" title="The live rules could not be loaded">
        <Button tone="secondary" size="compact-sm" onClick={() => void rows.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }
  if (rows.isLoading)
    return (
      <Text size="sm" c="dimmed">
        Loading the live rules…
      </Text>
    );
  const data = rows.data ?? [];
  if (data.length === 0)
    return (
      <Text size="sm" c="dimmed">
        No live rules in this area yet.
      </Text>
    );
  return (
    <Table aria-label={`Live ${AREA_LABEL[area]}`} stickyHeader>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Live rule</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((r) => {
          const title = rowTitle(area, r.fields);
          const busy = staged.has(r.id);
          return (
            <Table.Tr key={r.id}>
              <Table.Td>
                {title}
                {busy ? " (in this change)" : ""}
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <IconButton
                    tone="default"
                    size="sm"
                    disabled={busy}
                    aria-label={`Change ${title}`}
                    onClick={() => onEdit(r.id)}
                  >
                    <IconPencil size={16} />
                  </IconButton>
                  <IconButton
                    tone="danger"
                    size="sm"
                    disabled={busy}
                    aria-label={`Propose removing ${title}`}
                    onClick={() => onRemove(r.id)}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Group>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
