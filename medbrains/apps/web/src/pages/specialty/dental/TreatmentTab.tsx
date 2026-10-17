import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DentalTreatmentItem, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, Input, NumberField, toast } from "@/components/ui";
import { formatMoney } from "@/pages/patient-detail/shared";
import { specialtyService } from "@/services/specialty.service";

const FDI = /^([1-4][1-8]|[5-8][1-5])$/;
const schema = z.object({
  tooth_number: z
    .string()
    .trim()
    .refine((t) => t === "" || FDI.test(t), "Use an FDI number, such as 36"),
  procedure: z.string().trim().min(2, "Name the procedure"),
  price: z.number({ error: "Enter the price" }).min(0),
  charge_code: z.string().trim(),
});
type Plan = z.infer<typeof schema>;
const EMPTY = { tooth_number: "", procedure: "", price: Number.NaN, charge_code: "" };

const STATUS: Record<DentalTreatmentItem["status"], BadgeTone> = {
  planned: "warning",
  done: "success",
  cancelled: "neutral",
};

/** The plan, procedure by procedure: planned, then done (and billed) or cancelled. */
export function TreatmentTab({ examId }: { examId: string }) {
  const canPlan = useHasPermission(P.SPECIALTY.DENTAL.TREATMENT_MANAGE);
  const canComplete = useHasPermission(P.SPECIALTY.DENTAL.TREATMENT_COMPLETE);
  const queryClient = useQueryClient();
  const key = ["dental-treatment", examId];
  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: key,
    queryFn: () => specialtyService.listDentalTreatment(examId),
  });
  const form = useForm<Plan>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const plan = useMutation({
    mutationFn: (v: Plan) =>
      specialtyService.planDentalTreatment(examId, {
        tooth_number: v.tooth_number || undefined,
        procedure: v.procedure,
        price: v.price,
        charge_code: v.charge_code || undefined,
      }),
    onSuccess: () => {
      refresh();
      form.reset(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Procedure not planned" }),
  });
  const complete = useMutation({
    mutationFn: (id: string) => specialtyService.completeDentalTreatment(id),
    onSuccess: () => {
      refresh();
      toast.success("Charged to the visit's bill.", { title: "Procedure done" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not marked done" }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => specialtyService.cancelDentalTreatment(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Not cancelled" }),
  });

  const total = (status: DentalTreatmentItem["status"]) =>
    items.filter((i) => i.status === status).reduce((sum, i) => sum + Number(i.price), 0);
  const columns: Column<DentalTreatmentItem>[] = [
    { key: "tooth_number", label: "Tooth", render: (r) => r.tooth_number ?? "—" },
    { key: "procedure", label: "Procedure", render: (r) => r.procedure },
    { key: "price", label: "Price", render: (r) => formatMoney(r.price) },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={STATUS[r.status]}>{r.status}</Badge>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "planned" && (
          <Group gap={4} wrap="nowrap">
            {canComplete && (
              <Button
                size="xs"
                tone="secondary"
                onClick={() => complete.mutate(r.id)}
                aria-label={`Mark ${r.procedure} done`}
              >
                Done
              </Button>
            )}
            {canPlan && (
              <Button
                size="xs"
                tone="danger-ghost"
                onClick={() => cancel.mutate(r.id)}
                aria-label={`Cancel ${r.procedure}`}
              >
                Cancel
              </Button>
            )}
          </Group>
        ),
    },
  ];

  return (
    <Stack gap="md">
      {canPlan && (
        <form
          aria-label="Plan a procedure"
          noValidate
          onSubmit={form.handleSubmit((v) => plan.mutate(v))}
        >
          <Group align="flex-start" gap="xs">
            <Input
              label="Tooth (FDI)"
              w={100}
              {...form.register("tooth_number")}
              error={form.formState.errors.tooth_number?.message}
            />
            <Input
              label="Procedure"
              required
              {...form.register("procedure")}
              error={form.formState.errors.procedure?.message}
            />
            <Controller
              control={form.control}
              name="price"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Price"
                  required
                  min={0}
                  w={120}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : Number.NaN)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Input label="Charge code" w={120} {...form.register("charge_code")} />
            <Button type="submit" mt={24} loading={plan.isPending}>
              Add to plan
            </Button>
          </Group>
        </form>
      )}
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        rowKey={(r) => r.id}
        emptyTitle="Nothing planned yet."
      />
      <Text size="sm">
        Planned {formatMoney(total("planned"))} · Done and billed {formatMoney(total("done"))}
      </Text>
    </Stack>
  );
}
