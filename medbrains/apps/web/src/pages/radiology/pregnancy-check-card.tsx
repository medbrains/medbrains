/**
 * Before an X-ray, CT, fluoroscopy, mammography or nuclear medicine
 * exposure of a woman aged 12 to 50: is she, or may she be, pregnant? The
 * answer, how it was established, and — if she may be — why the exam goes
 * ahead. The exam cannot be started until this is recorded.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PregnancyCheckMethod, PregnancyStatus, RadiologyOrder } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Card, SegmentedControl, TextArea, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const STATUS_LABEL: Record<PregnancyStatus, string> = {
  not_pregnant: "Not pregnant",
  pregnant: "Pregnant",
  cannot_rule_out: "Cannot be ruled out",
};
const METHOD_LABEL: Record<PregnancyCheckMethod, string> = {
  asked: "Asked the patient",
  lmp: "Last menstrual period",
  urine_test: "Urine pregnancy test",
  serum_test: "Serum β-hCG",
};

const schema = z
  .object({
    status: z.enum(["not_pregnant", "pregnant", "cannot_rule_out"]),
    method: z.enum(["asked", "lmp", "urine_test", "serum_test"]),
    justification: z.string().trim(),
  })
  .refine((v) => v.status === "not_pregnant" || v.justification !== "", {
    path: ["justification"],
    message: "Say why the exam goes ahead — the benefit, or the emergency",
  });
type Form = z.infer<typeof schema>;

interface PregnancyCheckCardProps {
  order: RadiologyOrder;
}

export function PregnancyCheckCard({ order }: PregnancyCheckCardProps) {
  const qc = useQueryClient();
  const canRecord = useHasPermission(P.RADIOLOGY.ORDERS_PREGNANCY_CHECK);
  const { control, handleSubmit, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { status: "not_pregnant", method: "asked", justification: "" },
  });
  const save = useMutation({
    mutationFn: (v: Form) =>
      radiologyService.recordPregnancyCheck(order.id, {
        status: v.status,
        method: v.method,
        ...(v.justification ? { justification: v.justification } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", order.id] });
      toast.success("The exam can start.", { title: "Pregnancy check recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not recorded" }),
  });

  if (order.pregnancy_status) {
    const risky = order.pregnancy_status !== "not_pregnant";
    return (
      <Card withBorder padding="sm">
        <Group gap="xs">
          <Text size="sm" fw={600}>
            Pregnancy check
          </Text>
          <Badge tone={risky ? "warning" : "success"}>{STATUS_LABEL[order.pregnancy_status]}</Badge>
          {order.pregnancy_check_method && (
            <Text size="xs" c="dimmed">
              {METHOD_LABEL[order.pregnancy_check_method]}
              {order.pregnancy_checked_at
                ? ` · ${new Date(order.pregnancy_checked_at).toLocaleString()}`
                : ""}
            </Text>
          )}
        </Group>
        {risky && order.pregnancy_justification && (
          <Text size="sm" mt={4}>
            Going ahead because: {order.pregnancy_justification}
          </Text>
        )}
      </Card>
    );
  }
  if (!canRecord)
    return (
      <Alert tone="warning" title="Pregnancy check needed">
        Ask whether she is or may be pregnant before the exposure. The exam cannot start until it is
        recorded.
      </Alert>
    );
  const status = watch("status");
  return (
    <Card withBorder padding="sm">
      <form aria-label="Pregnancy check" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Pregnancy check before the exposure
          </Text>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Is she, or may she be, pregnant?"
                data={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select
                label="How it was established"
                data={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "asked")}
                allowDeselect={false}
              />
            )}
          />
          {status !== "not_pregnant" && (
            <Controller
              control={control}
              name="justification"
              render={({ field, fieldState }) => (
                <TextArea
                  label="Why the exam goes ahead"
                  required
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={save.isPending}>
              Record
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
