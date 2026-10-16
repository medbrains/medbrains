/**
 * The cash count that closes a counter day: notes and coins by denomination,
 * against what the drawers should hold, with a reason for any difference.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DayCloseRow } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, NumberField, TextArea, toast } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";

/** Notes and coins a counter takes, largest first. */
export const DENOMINATIONS = [
  "2000",
  "500",
  "200",
  "100",
  "50",
  "20",
  "10",
  "5",
  "2",
  "1",
] as const;

const schema = z.object({
  counts: z.record(z.string(), z.number().int().min(0)),
  variance_reason: z.string(),
  float_carried_forward: z.number().min(0),
});
type FormValues = z.infer<typeof schema>;

export function countedTotal(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((sum, [d, n]) => sum + Number(d) * (n || 0), 0);
}

interface DayCloseFormProps {
  locationId: string;
  businessDate: string;
  expectedCash: number;
  onClosed: (row: DayCloseRow) => void;
}

export function DayCloseForm({
  locationId,
  businessDate,
  expectedCash,
  onClosed,
}: DayCloseFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      counts: Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])),
      variance_reason: "",
      float_carried_forward: 0,
    },
  });
  const counts = useWatch({ control: form.control, name: "counts" });
  const float = useWatch({ control: form.control, name: "float_carried_forward" });
  const counted = countedTotal(counts);
  const variance = Math.round((counted - expectedCash) * 100) / 100;

  const close = useMutation({
    mutationFn: (values: FormValues) =>
      pharmacyFinanceService.closeCounterDay({
        pharmacy_location_id: locationId,
        business_date: businessDate,
        denominations: Object.fromEntries(Object.entries(values.counts).filter(([, n]) => n > 0)),
        variance_reason: values.variance_reason.trim() || undefined,
        float_carried_forward: values.float_carried_forward,
      }),
    onSuccess: (row) => {
      toast.success(`The ${businessDate} day is closed.`);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-day-close"] });
      onClosed(row);
    },
  });

  const submit = form.handleSubmit((values) => {
    if (variance !== 0 && values.variance_reason.trim().length < 5) {
      form.setError("variance_reason", { message: "Say why the count differs" });
      return;
    }
    if (values.float_carried_forward > counted) {
      form.setError("float_carried_forward", { message: "Cannot keep more than was counted" });
      return;
    }
    close.mutate(values);
  });

  return (
    <Stack component="form" gap="md" onSubmit={submit} aria-label="Close the day">
      <Text size="sm" fw={600}>
        Count the cash
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
        {DENOMINATIONS.map((d) => (
          <Controller
            key={d}
            control={form.control}
            name={`counts.${d}`}
            render={({ field }) => (
              <NumberField
                label={`₹${d}`}
                aria-label={`Number of ₹${d}`}
                min={0}
                allowDecimal={false}
                value={field.value}
                onChange={(v) => field.onChange(Number(v) || 0)}
              />
            )}
          />
        ))}
      </SimpleGrid>
      <Group gap="xl">
        <Text size="sm">Counted ₹{counted.toFixed(2)}</Text>
        <Text size="sm">Expected ₹{expectedCash.toFixed(2)}</Text>
        <Text
          size="sm"
          fw={700}
          c={variance === 0 ? undefined : "danger"}
          data-testid="day-variance"
        >
          {variance === 0
            ? "No difference"
            : `${variance > 0 ? "Over" : "Short"} by ₹${Math.abs(variance).toFixed(2)}`}
        </Text>
      </Group>
      <Controller
        control={form.control}
        name="variance_reason"
        render={({ field, fieldState }) => (
          <TextArea
            {...field}
            label="Why the count differs"
            withAsterisk={variance !== 0}
            disabled={variance === 0}
            minRows={2}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="float_carried_forward"
        render={({ field, fieldState }) => (
          <NumberField
            label="Kept back as tomorrow's float"
            description={`To deposit: ₹${Math.max(0, counted - (float || 0)).toFixed(2)}`}
            min={0}
            decimalScale={2}
            value={field.value}
            onChange={(v) => field.onChange(Number(v) || 0)}
            error={fieldState.error?.message}
          />
        )}
      />
      {close.isError && (
        <Alert tone="danger" role="alert">
          {close.error.message}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button type="submit" tone="primary" loading={close.isPending}>
          Close the day
        </Button>
      </Group>
    </Stack>
  );
}
