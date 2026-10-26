// Clinical-kb ResolveReportModal — split from clinical-kb.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { NotifiableReport } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Modal, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

const resolveSchema = z.object({
  status: z.enum(["submitted", "exempted"]),
  report_ref: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
type ResolveValues = z.infer<typeof resolveSchema>;

interface ResolveReportModalProps {
  report: Pick<NotifiableReport, "id" | "disease_name" | "icd10_code"> | null;
  onClose: () => void;
  /** What the authority's acknowledgement is called there. */
  refLabel?: string;
  refPlaceholder?: string;
  /** A submission is not recorded without the acknowledgement (Ni-kshay ID). */
  requireRef?: boolean;
}

export function ResolveReportModal({
  report,
  onClose,
  refLabel = "Report reference (IHIP/IDSP ack no.)",
  refPlaceholder = "e.g. IHIP-2026-00481",
  requireRef = false,
}: ResolveReportModalProps) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { status: "submitted", report_ref: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResolveValues) =>
      ckbService.updateNotifiableReport(report?.id ?? "", {
        status: values.status,
        report_ref: values.report_ref || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ckb-notifiable-reports"] });
      void qc.invalidateQueries({ queryKey: ["ckb-nikshay"] });
      toast.success("Report updated", { title: "Notifiable disease" });
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not update" }),
  });

  return (
    <Modal opened={report !== null} onClose={onClose} title="Resolve notifiable report" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {report?.disease_name} ({report?.icd10_code})
        </Text>
        <Controller
          control={control}
          name="report_ref"
          render={({ field }) => (
            <TextInput
              label={refLabel}
              placeholder={refPlaceholder}
              required={requireRef}
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.report_ref?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea
              label="Notes"
              autosize
              minRows={2}
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
        <Group justify="flex-end">
          <Button
            tone="secondary"
            loading={mutation.isPending}
            onClick={handleSubmit((v) => mutation.mutate({ ...v, status: "exempted" }))}
          >
            Exempt
          </Button>
          <Button
            tone="primary"
            loading={mutation.isPending}
            onClick={handleSubmit((v) => {
              if (requireRef && !v.report_ref) {
                setError("report_ref", { message: `Give the ${refLabel}` });
                return;
              }
              mutation.mutate({ ...v, status: "submitted" });
            })}
          >
            Mark submitted
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
