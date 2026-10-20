import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { BillingEntity, BillingLane } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Modal, NumberField, SegmentedControl, Select, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { LANE_LABELS } from "./lane-labels";

const laneSchema = z.object({
  legal_entity_id: z.string().min(1, "Pick the entity that bills this department"),
  revenue_department_id: z.string(),
  default_mode: z.enum(["individual", "together"]),
  charge_at: z.enum(["checkin", "complete"]),
  fee_amount: z.number().min(0, "A fee cannot be negative").nullable(),
});
type LaneForm = z.infer<typeof laneSchema>;

interface BillingLaneModalProps {
  lane: BillingLane | null;
  entities: BillingEntity[];
  onClose: () => void;
}

/** The lanes whose fee the hospital charges at check-in or at completion. */
const TIMED_LANES = new Set(["registration", "opd"]);

function defaultsOf(lane: BillingLane | null): LaneForm {
  return {
    legal_entity_id: lane?.legal_entity_id ?? "",
    revenue_department_id: lane?.revenue_department_id ?? "",
    default_mode: lane?.default_mode ?? "together",
    charge_at: lane?.charge_at ?? "checkin",
    fee_amount: lane?.fee_amount == null ? null : Number(lane.fee_amount),
  };
}

/** Edit one department lane: who bills it, how, and when its fee is charged. */
export function BillingLaneModal({ lane, entities, onClose }: BillingLaneModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LaneForm>({ resolver: zodResolver(laneSchema), values: defaultsOf(lane) });
  const save = useMutation({
    mutationFn: (form: LaneForm) =>
      billingService.updateBillingLane(lane?.lane ?? "opd", {
        ...form,
        revenue_department_id: form.revenue_department_id || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing-lanes"] });
      toast.success("Lane saved");
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });
  const name = lane ? LANE_LABELS[lane.lane] : "";
  return (
    <Modal
      opened={lane !== null}
      onClose={onClose}
      title={`${name} billing`}
      primaryAction={{
        label: "Save",
        onClick: handleSubmit((form) => save.mutate(form)),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="legal_entity_id"
          render={({ field }) => (
            <Select
              label="Billed by (legal entity)"
              data={entities
                .filter((e) => e.is_active)
                .map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.legal_entity_id?.message}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="revenue_department_id"
          render={({ field }) => (
            <DepartmentSelect
              label="Revenue department"
              placeholder="The visit's department"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Bills
          </Text>
          <Controller
            control={control}
            name="default_mode"
            render={({ field }) => (
              <SegmentedControl
                data={[
                  { value: "individual", label: "On its own" },
                  { value: "together", label: "With the visit's bill" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Text size="xs" c="dimmed">
            On its own: the desk collects its own bill. Admitted patients always get one bill.
          </Text>
        </Stack>
        {lane && TIMED_LANES.has(lane.lane) && (
          <Controller
            control={control}
            name="charge_at"
            render={({ field }) => (
              <Select
                label="Charge the fee"
                data={[
                  { value: "checkin", label: "At check-in" },
                  { value: "complete", label: "When the consultation is completed" },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "checkin")}
                allowDeselect={false}
              />
            )}
          />
        )}
        {lane?.lane === "registration" && (
          <Controller
            control={control}
            name="fee_amount"
            render={({ field }) => (
              <NumberField
                label="Registration fee (₹)"
                description="Leave empty to charge none"
                min={0}
                decimalScale={2}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                error={errors.fee_amount?.message}
              />
            )}
          />
        )}
      </Stack>
    </Modal>
  );
}
