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
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Modal,
  NumberField,
  Select,
  TextArea,
} from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import {
  blankToUndefined,
  formatDateTime,
  labelOf,
  RESTRAINT_TYPES,
  RESTRAINT_TYPES_ALLOWED,
} from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

/** Same bound as the server (MHCA 2017 / NABH: time-limited, reviewed). */
const MAX_REVIEW_HOURS = 4;

const schema = z.object({
  restraint_type: z.enum(["physical", "chemical"]),
  reason: z.string().trim().min(5, "Record why restraint is necessary"),
  method: z.string().trim().min(1, "Record the method and nature of the restraint (s.97(3))"),
  last_resort_confirmed: z.literal(true, {
    error: "Restraint is lawful only as the last means to prevent imminent harm",
  }),
  authorised_by: z.string(),
  review_due_hours: z.number().int().min(1).max(MAX_REVIEW_HOURS),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

const REP_NOTICE_HOURS = 24;

function isOverdue(r: PsychSeclusionRestraint): boolean {
  return !r.end_time && new Date(r.review_due_at).getTime() < Date.now();
}

/** s.97(5): the nominated representative is told within 24 hours. */
function repNoticeLate(r: PsychSeclusionRestraint): boolean {
  const deadline = new Date(r.start_time).getTime() + REP_NOTICE_HOURS * 3_600_000;
  return !r.nominated_rep_informed_at && deadline < Date.now();
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
    defaultValues: {
      restraint_type: "physical",
      reason: "",
      method: "",
      authorised_by: "",
      review_due_hours: 4,
      notes: "",
    },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createRestraint(psychPatientId, {
        ...v,
        authorised_by: blankToUndefined(v.authorised_by),
        notes: blankToUndefined(v.notes),
      }),
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

  const informed = useMutation({
    mutationFn: (id: string) => psychiatryService.markRestraintRepInformed(id),
    onSuccess: invalidate,
  });

  const columns = useMemo<Column<PsychSeclusionRestraint>[]>(
    () => [
      {
        key: "type",
        label: "Type",
        render: (r) => <Badge tone="warning">{labelOf(RESTRAINT_TYPES, r.restraint_type)}</Badge>,
      },
      { key: "reason", label: "Reason", render: (r) => <Text size="sm">{r.reason}</Text> },
      { key: "method", label: "Method", render: (r) => <Text size="sm">{r.method ?? "—"}</Text> },
      {
        key: "rep",
        label: "Representative told",
        render: (r) =>
          r.nominated_rep_informed_at ? (
            <Text size="sm">{formatDateTime(r.nominated_rep_informed_at)}</Text>
          ) : (
            <Group gap={4} wrap="nowrap">
              {repNoticeLate(r) && <IconAlertTriangle size={16} aria-hidden />}
              <Text size="sm">{repNoticeLate(r) ? "Not yet — over 24 hours" : "Not yet"}</Text>
              {canManage && (
                <Button tone="ghost" size="compact-xs" onClick={() => informed.mutate(r.id)}>
                  Mark told
                </Button>
              )}
            </Group>
          ),
      },
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
    [canManage, informed.mutate],
  );

  return (
    <RecordListFrame
      description="Restraint episodes (MHCA s.97): the last means to prevent imminent harm, authorised by the psychiatrist in charge, reviewed at least every four hours, the representative told within 24 hours. Seclusion is prohibited."
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
        title="Start restraint"
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
                data={RESTRAINT_TYPES_ALLOWED}
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
            name="method"
            render={({ field, fieldState }) => (
              <Input
                label="Method and nature"
                placeholder="e.g. four-point soft limb restraints"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="authorised_by"
            render={({ field }) => (
              <DoctorSearchSelect
                label="Authorised by (psychiatrist in charge)"
                placeholder="You, if left blank"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="last_resort_confirmed"
            render={({ field, fieldState }) => (
              <Checkbox
                label="The only means to prevent imminent harm — not punishment, not for want of staff"
                checked={field.value === true}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
                error={fieldState.error?.message}
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
      {informed.isError && <Alert tone="danger">{informed.error.message}</Alert>}
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
