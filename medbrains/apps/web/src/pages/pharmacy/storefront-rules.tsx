import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DeliverySlotName, type HoldTier, P, type StorefrontRules } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Input, NumberField, TextArea, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";
import { ladderProblem } from "../store/storefront-p2";

const SLOTS: DeliverySlotName[] = ["morning", "afternoon", "evening"];
const num = z.number().int().min(0);
const schema = z.object({
  scarce_units: num,
  checkout_scarce: z.number().int().min(1),
  checkout_normal: z.number().int().min(1),
  review_scarce: z.number().int().min(1),
  review_normal: z.number().int().min(1),
  max_days_supply: z.number().int().min(1).max(90),
  repeat_flag_days: z.number().int().min(0).max(90),
  free_delivery_above: num,
  cod_max_amount: num,
  morning: num,
  afternoon: num,
  evening: num,
  partner_name: z.string(),
  partner_address: z.string(),
  partner_phone: z.string(),
  partner_disclosure: z.string(),
});
type Form = z.infer<typeof schema>;

const minutes = (tiers: HoldTier[], open: boolean) =>
  (open ? tiers[tiers.length - 1] : tiers[0])?.minutes ?? 15;

function toForm(r: StorefrontRules): Form {
  const slot = (s: DeliverySlotName) => r.delivery_slots.find((x) => x.slot === s)?.capacity ?? 0;
  return {
    scarce_units: r.hold_tiers.checkout[0]?.max_available ?? 10,
    checkout_scarce: minutes(r.hold_tiers.checkout, false),
    checkout_normal: minutes(r.hold_tiers.checkout, true),
    review_scarce: minutes(r.hold_tiers.review, false),
    review_normal: minutes(r.hold_tiers.review, true),
    max_days_supply: r.max_days_supply,
    repeat_flag_days: r.repeat_flag_days,
    free_delivery_above: Number(r.free_delivery_above),
    cod_max_amount: Number(r.cod_max_amount),
    morning: slot("morning"),
    afternoon: slot("afternoon"),
    evening: slot("evening"),
    partner_name: r.outside_partner?.name ?? "",
    partner_address: r.outside_partner?.address ?? "",
    partner_phone: r.outside_partner?.phone ?? "",
    partner_disclosure: r.outside_partner?.disclosure ?? "",
  };
}

function ladder(units: number, scarce: number, normal: number): HoldTier[] {
  return [
    { max_available: units, minutes: scarce },
    { max_available: null, minutes: normal },
  ];
}

function toRules(f: Form): StorefrontRules {
  return {
    hold_tiers: {
      checkout: ladder(f.scarce_units, f.checkout_scarce, f.checkout_normal),
      review: ladder(f.scarce_units, f.review_scarce, f.review_normal),
    },
    max_days_supply: f.max_days_supply,
    repeat_flag_days: f.repeat_flag_days,
    free_delivery_above: f.free_delivery_above,
    cod_max_amount: f.cod_max_amount,
    delivery_slots: SLOTS.filter((s) => f[s] > 0).map((s) => ({ slot: s, capacity: f[s] })),
    outside_partner: f.partner_name.trim()
      ? {
          name: f.partner_name,
          address: f.partner_address,
          phone: f.partner_phone,
          disclosure: f.partner_disclosure,
        }
      : null,
  };
}

const FIELDS: { name: keyof Form; label: string; description?: string }[] = [
  { name: "scarce_units", label: "Scarce at or below (units)", description: "Shorter holds then" },
  { name: "checkout_scarce", label: "Checkout hold when scarce (min)" },
  { name: "checkout_normal", label: "Checkout hold otherwise (min)" },
  { name: "review_scarce", label: "Pharmacist-review hold when scarce (min)" },
  { name: "review_normal", label: "Pharmacist-review hold otherwise (min)" },
  { name: "max_days_supply", label: "Days of supply per order" },
  { name: "repeat_flag_days", label: "Flag a repeat within (days)", description: "0 turns it off" },
  { name: "free_delivery_above", label: "Free delivery from (₹)" },
  { name: "cod_max_amount", label: "Cash on delivery up to (₹)" },
  { name: "morning", label: "Morning slot orders a day", description: "0 turns the slot off" },
  { name: "afternoon", label: "Afternoon slot orders a day" },
  { name: "evening", label: "Evening slot orders a day" },
];

/**
 * The hospital's online-order rules: how long stock is held at checkout and
 * through pharmacist review (shorter when scarce), supply and repeat limits,
 * delivery slots, free delivery and the cash-on-delivery cap, and a
 * disclosed partner pharmacy for the outside print — never named without
 * its disclosure.
 */
export function StorefrontRulesForm() {
  const canManage = useHasPermission(P.PHARMACY.STOREFRONT.MANAGE);
  const queryClient = useQueryClient();
  const rules = useQuery({
    queryKey: ["storefront-rules"],
    queryFn: () => storefrontService.getStorefrontRules(),
    enabled: canManage,
  });
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    values: rules.data ? toForm(rules.data) : undefined,
  });
  const save = useMutation({
    mutationFn: (f: Form) => {
      const next = toRules(f);
      const problem =
        ladderProblem(next.hold_tiers.checkout) ?? ladderProblem(next.hold_tiers.review);
      if (problem) throw new Error(problem);
      if (next.outside_partner && !next.outside_partner.disclosure.trim()) {
        throw new Error("A partner pharmacy is shown only with its disclosure");
      }
      return storefrontService.updateStorefrontRules(next);
    },
    onSuccess: () => {
      toast.success("Online-order rules saved");
      void queryClient.invalidateQueries({ queryKey: ["storefront-rules"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  if (!canManage) return null;
  if (rules.isError) {
    return (
      <Alert tone="danger" title="Rules could not be loaded">
        Try again in a moment.
      </Alert>
    );
  }
  return (
    <Card padding="md">
      <Stack component="form" gap="sm" onSubmit={handleSubmit((f) => save.mutate(f))}>
        <Text fw={600}>Online-order rules</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {FIELDS.map((f) => (
            <Controller
              key={f.name}
              control={control}
              name={f.name}
              render={({ field }) => (
                <NumberField
                  label={f.label}
                  description={f.description}
                  min={0}
                  value={Number(field.value ?? 0)}
                  onChange={(v) => field.onChange(Number(v) || 0)}
                />
              )}
            />
          ))}
        </SimpleGrid>
        <Text fw={600} size="sm">
          Partner pharmacy on the outside print (optional)
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {(["partner_name", "partner_address", "partner_phone"] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Input
                  label={name.replace("partner_", "").replace(/^./, (c) => c.toUpperCase())}
                  {...field}
                />
              )}
            />
          ))}
        </SimpleGrid>
        <Controller
          control={control}
          name="partner_disclosure"
          render={({ field }) => (
            <TextArea
              label="Disclosure shown beside it"
              description="Why the hospital names it, and that the patient may buy anywhere"
              {...field}
            />
          )}
        />
        <Button type="submit" tone="primary" loading={save.isPending}>
          Save rules
        </Button>
      </Stack>
    </Card>
  );
}
