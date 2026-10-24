import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychMhrbNotification } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { Alert, Input, Modal, Select, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, formatDate, MHRB_STATUSES } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

const schema = z.object({
  notification_type: z.string().trim().min(1, "Say what is being notified"),
  reference_number: z.string().max(100),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

export function MhrbTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  // The list endpoint itself requires manage: a role without it never fetches.
  const canManage = useHasPermission(P.SPECIALTY.PSYCHIATRY.MHRB_MANAGE);
  const query = usePsychList("psych-mhrb", psychPatientId, psychiatryService.listMhrb, canManage);
  const [open, setOpen] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["psych-mhrb", psychPatientId] });
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { notification_type: "", reference_number: "", notes: "" },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createMhrb(psychPatientId, {
        notification_type: v.notification_type,
        reference_number: blankToUndefined(v.reference_number),
        notes: blankToUndefined(v.notes),
      }),
    onSuccess: () => {
      invalidate();
      reset();
      setOpen(false);
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      psychiatryService.updateMhrb(id, { status }),
    onSuccess: invalidate,
  });

  const columns = useMemo<Column<PsychMhrbNotification>[]>(
    () => [
      { key: "type", label: "Notice", render: (r) => <Text size="sm">{r.notification_type}</Text> },
      {
        key: "ref",
        label: "Reference",
        render: (r) => <Text size="sm">{r.reference_number ?? "—"}</Text>,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <Select
            aria-label={`Status of ${r.notification_type}`}
            data={MHRB_STATUSES}
            value={r.status}
            onChange={(v) => v && v !== r.status && setStatus.mutate({ id: r.id, status: v })}
            allowDeselect={false}
            size="xs"
          />
        ),
      },
      { key: "sent", label: "Sent", render: (r) => <Text size="sm">{formatDate(r.sent_at)}</Text> },
      {
        key: "ack",
        label: "Acknowledged",
        render: (r) => <Text size="sm">{formatDate(r.acknowledged_at)}</Text>,
      },
    ],
    [setStatus.mutate],
  );

  if (!canManage) {
    return (
      <Alert tone="info">Mental Health Review Board notices are kept by authorised staff.</Alert>
    );
  }
  return (
    <RecordListFrame
      description="Notices to the Mental Health Review Board."
      addLabel="Add notice"
      canAdd={canManage}
      onAdd={() => setOpen(true)}
      columns={columns}
      query={query}
      emptyTitle="No notices"
    >
      {setStatus.isError && <Alert tone="danger">{setStatus.error.message}</Alert>}
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Add MHRB notice"
        primaryAction={{
          label: "Save notice",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="notification_type"
            render={({ field, fieldState }) => (
              <Input
                label="Notice"
                placeholder="e.g. Supported admission, Restraint report"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="reference_number"
            render={({ field }) => <Input label="Board reference" {...field} />}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <TextArea label="Notes" autosize minRows={2} {...field} />}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
    </RecordListFrame>
  );
}
