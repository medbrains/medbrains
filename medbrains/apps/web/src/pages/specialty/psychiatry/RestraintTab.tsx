import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychSeclusionRestraint } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Button, Modal, NumberField, Select, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, formatDateTime, labelOf, RESTRAINT_TYPES } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

/** Same bound as the server (MHCA 2017 / NABH: time-limited, reviewed). */
const MAX_REVIEW_HOURS = 4;

const schema = z.object({
  restraint_type: z.enum(["physical", "chemical", "seclusion"]),
  reason: z.string().trim().min(5, "Record why restraint is necessary"),
  review_due_hours: z.number().int().min(1).max(MAX_REVIEW_HOURS),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

function isOverdue(r: PsychSeclusionRestraint): boolean {
  return !r.end_time && new Date(r.review_due_at).getTime() < Date.now();
}

export function RestraintTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.RESTRAINT_LIST);
  const canManage = useHasPermission(P.SPECIALTY.PSYCHIATRY.RESTRAINT_MANAGE);
  const query = usePsychList(
    "psych-restraints",
    psychPatientId,
    psychiatryService.listRestraints,
    canList,
  );
  const [open, setOpen] = useState(false);
  const [releasing, setReleasing] = useState<PsychSeclusionRestraint | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["psych-restraints", psychPatientId] });

  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { restraint_type: "physical", reason: "", review_due_hours: 4, notes: "" },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createRestraint(psychPatientId, { ...v, notes: blankToUndefined(v.notes) }),
    onSuccess: () => {
      invalidate();
      reset();
      setOpen(false);
    },
  });
  const release = useMutation({
    mutationFn: (r: PsychSeclusionRestraint) =>
      psychiatryService.releaseRestraint(r.id, { notes: blankToUndefined(releaseNotes) }),
    onSuccess: () => {
      invalidate();
      setReleasing(null);
      setReleaseNotes("");
    },
  });

  const columns = useMemo<Column<PsychSeclusionRestraint>[]>(
    () => [
      {
        key: "type",
        label: "Type",
        render: (r) => <Badge tone="warning">{labelOf(RESTRAINT_TYPES, r.restraint_type)}</Badge>,
      },
      { key: "reason", label: "Reason", render: (r) => <Text size="sm">{r.reason}</Text> },
      {
        key: "start",
        label: "Started",
        render: (r) => <Text size="sm">{formatDateTime(r.start_time)}</Text>,
      },
      {
        key: "review",
        label: "Review due",
        render: (r) => (
          <Group gap={4} wrap="nowrap">
            {isOverdue(r) && <IconAlertTriangle size={16} aria-hidden />}
            <Text size="sm">
              {formatDateTime(r.review_due_at)}
              {isOverdue(r) ? " — overdue" : ""}
            </Text>
          </Group>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (r) =>
          r.end_time ? (
            <Badge tone="success">Ended {formatDateTime(r.end_time)}</Badge>
          ) : (
            <Badge tone="danger">In force</Badge>
          ),
      },
      {
        key: "actions",
        label: "",
        render: (r) =>
          !r.end_time && canManage ? (
            <Button tone="tertiary" size="xs" onClick={() => setReleasing(r)}>
              End restraint
            </Button>
          ) : null,
      },
    ],
    [canManage],
  );

  return (
    <RecordListFrame
      description="Seclusion and restraint episodes. Each must be time-limited and reviewed at least every four hours."
      addLabel="Start restraint"
      canAdd={canManage}
      onAdd={() => setOpen(true)}
      columns={columns}
      query={query}
      emptyTitle="No restraint episodes"
    >
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Start restraint or seclusion"
        danger
        primaryAction={{
          label: "Start",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="restraint_type"
            render={({ field }) => (
              <Select
                label="Type"
                data={RESTRAINT_TYPES}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <TextArea
                label="Why it is necessary"
                description="Restraint is a last resort to prevent imminent harm to the patient or others."
                required
                autosize
                minRows={2}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="review_due_hours"
            render={({ field, fieldState }) => (
              <NumberField
                label="Review within (hours)"
                min={1}
                max={MAX_REVIEW_HOURS}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === "number" ? v : MAX_REVIEW_HOURS)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <TextArea label="Notes" autosize minRows={2} {...field} />}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
      <Modal
        opened={releasing !== null}
        onClose={() => setReleasing(null)}
        title="End restraint"
        primaryAction={{
          label: "End restraint",
          onClick: () => releasing && release.mutate(releasing),
          loading: release.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setReleasing(null) }}
      >
        <Stack gap="sm">
          <TextArea
            label="Notes at release"
            autosize
            minRows={2}
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.currentTarget.value)}
          />
          {release.isError && <Alert tone="danger">{release.error.message}</Alert>}
        </Stack>
      </Modal>
    </RecordListFrame>
  );
}
