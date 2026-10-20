import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PayoutCalcResult } from "@medbrains/types";
import { IconCalculator } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { errorText, rupees } from "./shared";

const amount = z.string().regex(/^\d+(\.\d{1,2})?$/, "An amount like 1000");

export const calcSchema = z.object({
  charge_code: z.string().trim().min(1, "The charge code"),
  category: z.string().trim(),
  payer_class: z.string(),
  visit_kind: z.string(),
  role: z.enum(["primary", "assistant", "anaesthetist"]),
  gross: amount,
  discount: amount,
});

type CalcForm = z.infer<typeof calcSchema>;

/** "This line would pay X": try a rate card before a doctor is paid by it. */
export function RateCalculator({ cardId }: { cardId: string }) {
  const { control, handleSubmit } = useForm<CalcForm>({
    resolver: zodResolver(calcSchema),
    defaultValues: {
      charge_code: "",
      category: "",
      payer_class: "cash",
      visit_kind: "first",
      role: "primary",
      gross: "1000",
      discount: "0",
    },
  });
  const calc = useMutation<PayoutCalcResult, Error, CalcForm>({
    mutationFn: (v) =>
      doctorPayoutsService.calculatePayout(cardId, {
        ...v,
        quantity: 1,
        visit_kind: v.visit_kind || null,
      }),
  });
  const field = (name: keyof CalcForm, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <Input label={label} {...f} error={fieldState.error?.message} />
      )}
    />
  );
  return (
    <Card>
      <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => calc.mutate(v))}>
        <Text fw={600}>Test calculator</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {field("charge_code", "Charge code")}
          {field("category", "Category")}
          <Controller
            control={control}
            name="payer_class"
            render={({ field: f }) => (
              <Select
                label="Payer"
                data={["cash", "tpa", "cghs", "echs", "pmjay"]}
                allowDeselect={false}
                value={f.value}
                onChange={(v) => f.onChange(v ?? "cash")}
              />
            )}
          />
          <Controller
            control={control}
            name="role"
            render={({ field: f }) => (
              <Select
                label="Role"
                data={[
                  { value: "primary", label: "Performing" },
                  { value: "assistant", label: "Assistant" },
                  { value: "anaesthetist", label: "Anaesthetist" },
                ]}
                allowDeselect={false}
                value={f.value}
                onChange={(v) => f.onChange(v ?? "primary")}
              />
            )}
          />
          {field("gross", "Line amount (Rs)")}
          {field("discount", "Discount (Rs)")}
        </SimpleGrid>
        <Group justify="space-between">
          {calc.data &&
            (calc.data.rule ? (
              <Text>
                Pays <strong>{rupees(calc.data.amount)}</strong> on {rupees(calc.data.base)} under “
                {calc.data.rule.rule_name}”.
              </Text>
            ) : (
              <Text>No rule matches; this line pays the doctor nothing.</Text>
            ))}
          <Button
            type="submit"
            tone="secondary"
            leftSection={<IconCalculator size={14} />}
            loading={calc.isPending}
          >
            Calculate
          </Button>
        </Group>
        {calc.isError && <Alert tone="danger">{errorText(calc.error)}</Alert>}
      </Stack>
    </Card>
  );
}
