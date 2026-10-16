// Currency settings — the rates a foreign-currency bill is converted at.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CurrencyCode, ExchangeRate } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { Alert, Button, Input, NumberField, Select, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const FOREIGN_CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SAR",
  "SGD",
  "BDT",
  "NPR",
  "LKR",
];

export const exchangeRateSchema = z.object({
  from_currency: z.enum(FOREIGN_CURRENCIES as [CurrencyCode, ...CurrencyCode[]]),
  rate: z.number({ message: "Enter the rate" }).positive("The rate must be more than zero"),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the rate applies from"),
  source: z.string().trim().max(120),
});

type RateForm = z.infer<typeof exchangeRateSchema>;

const columns = [
  { key: "effective_date", label: "From", render: (r: ExchangeRate) => r.effective_date },
  {
    key: "pair",
    label: "Rate",
    render: (r: ExchangeRate) => `1 ${r.from_currency} = ${r.rate} ${r.to_currency}`,
  },
  { key: "source", label: "Source", render: (r: ExchangeRate) => r.source ?? "—" },
];

export function ExchangeRatesSection() {
  const canView = useHasPermission(P.BILLING.INVOICES_LIST);
  const canManage = useHasPermission(P.BILLING.EXCHANGE_RATES_MANAGE);
  const queryClient = useQueryClient();

  const rates = useQuery({
    queryKey: ["billing", "exchange-rates"],
    queryFn: () => billingService.listExchangeRates(),
    enabled: canView,
  });

  const { control, handleSubmit, reset } = useForm<RateForm>({
    resolver: zodResolver(exchangeRateSchema),
    defaultValues: { from_currency: "USD", effective_date: "", source: "" },
  });

  const create = useMutation({
    mutationFn: (v: RateForm) =>
      billingService.createExchangeRate({ ...v, source: v.source || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "exchange-rates"] });
      reset();
      toast.success("Exchange rate saved");
    },
  });

  if (!canView) return null;

  return (
    <Stack>
      <Text fw={600}>Currencies</Text>
      <Text size="sm" c="dimmed">
        The rupee rate for each foreign currency the hospital bills in, by the date it applies from.
        The counter quotes and converts foreign-currency bills against these.
      </Text>
      {rates.isError ? (
        <Alert tone="danger" title="Rates could not be loaded">
          The exchange rates could not be read. Do not bill in a foreign currency until they load.
        </Alert>
      ) : rates.data?.length === 0 ? (
        <Alert tone="info">No exchange rates are set yet.</Alert>
      ) : (
        <DataTable
          columns={columns}
          data={rates.data ?? []}
          loading={rates.isLoading}
          rowKey={(r) => r.id}
        />
      )}
      {canManage && (
        <Stack gap="xs" component="form" onSubmit={handleSubmit((v) => create.mutate(v))}>
          <Group align="flex-start" grow>
            <Controller
              control={control}
              name="from_currency"
              render={({ field }) => (
                <Select
                  label="Currency"
                  data={FOREIGN_CURRENCIES}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "USD")}
                />
              )}
            />
            <Controller
              control={control}
              name="rate"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Rupees per unit"
                  min={0}
                  decimalScale={4}
                  value={field.value}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="effective_date"
              render={({ field, fieldState }) => (
                <Input
                  type="date"
                  label="Applies from"
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Input label="Source (optional)" placeholder="e.g. RBI reference rate" {...field} />
              )}
            />
          </Group>
          {create.isError && (
            <Alert tone="danger" title="Rate not saved">
              {create.error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              Add rate
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
