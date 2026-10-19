import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, toast } from "@/components/ui";
import { NhcxPayerSelect } from "./NhcxPayerSelect";

const MAX_DAYS = 92;
const DAY_MS = 86_400_000;

const searchSchema = z
  .object({
    recipient_code: z.string().min(1, "Pick the payer"),
    from_date: z.string().min(1, "Pick the first day"),
    to_date: z.string().min(1, "Pick the last day"),
    claim_number: z.string().trim().max(100),
  })
  .refine((v) => v.to_date >= v.from_date, {
    path: ["to_date"],
    message: "The last day comes after the first",
  })
  .refine((v) => (Date.parse(v.to_date) - Date.parse(v.from_date)) / DAY_MS <= MAX_DAYS, {
    path: ["to_date"],
    message: `Search at most ${MAX_DAYS} days at a time`,
  });
type SearchForm = z.infer<typeof searchSchema>;

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);

/** Ask a payer, through NHCX, which of this hospital's claims it holds. */
export function NhcxSearchForm() {
  const queryClient = useQueryClient();
  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      recipient_code: "",
      from_date: monthAgo(),
      to_date: today(),
      claim_number: "",
    },
  });
  const search = useMutation({
    mutationFn: (v: SearchForm) =>
      api.searchNhcxClaims({
        recipient_code: v.recipient_code,
        from_date: v.from_date,
        to_date: v.to_date,
        claim_number: v.claim_number || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nhcx-searches"] });
      toast.success("The payer's list will appear below when it answers.", {
        title: "Search sent",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Search not sent" }),
  });
  return (
    <Stack gap="xs" component="form" onSubmit={form.handleSubmit((v) => search.mutate(v))}>
      <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
        <Controller
          control={form.control}
          name="recipient_code"
          render={({ field, fieldState }) => (
            <NhcxPayerSelect
              value={field.value || null}
              onChange={(c) => field.onChange(c ?? "")}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="from_date"
          render={({ field, fieldState }) => (
            <Input label="From" type="date" required error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={form.control}
          name="to_date"
          render={({ field, fieldState }) => (
            <Input label="To" type="date" required error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={form.control}
          name="claim_number"
          render={({ field, fieldState }) => (
            <Input label="Claim number (optional)" error={fieldState.error?.message} {...field} />
          )}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button type="submit" size="xs" loading={search.isPending}>
          Search payer
        </Button>
      </Group>
    </Stack>
  );
}
