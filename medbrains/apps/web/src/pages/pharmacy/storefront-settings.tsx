import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type StorefrontSettings as Settings } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Input, NumberField, Select, Switch, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

const schema = z.object({
  enabled: z.boolean(),
  rx: z.number().min(0).max(50),
  otc: z.number().min(0).max(50),
  min_shelf_life_days: z.number().int().min(0),
  restricted_max_units: z.number().int().min(1),
  return_window_days: z.number().int().min(0),
  pharmacist_in_charge: z.string().uuid().or(z.literal("")),
  officer_name: z.string(),
  officer_email: z.string(),
  officer_phone: z.string(),
});
type Form = z.infer<typeof schema>;

function toForm(s: Settings): Form {
  return {
    enabled: s.enabled,
    rx: Number(s.discounts.rx),
    otc: Number(s.discounts.otc),
    min_shelf_life_days: s.min_shelf_life_days,
    restricted_max_units: s.restricted_max_units,
    return_window_days: s.return_window_days,
    pharmacist_in_charge: s.pharmacist_in_charge ?? "",
    officer_name: s.grievance_officer?.name ?? "",
    officer_email: s.grievance_officer?.email ?? "",
    officer_phone: s.grievance_officer?.phone ?? "",
  };
}

function toSettings(f: Form): Settings {
  return {
    enabled: f.enabled,
    discounts: { rx: f.rx, otc: f.otc },
    min_shelf_life_days: f.min_shelf_life_days,
    restricted_max_units: f.restricted_max_units,
    return_window_days: f.return_window_days,
    pharmacist_in_charge: f.pharmacist_in_charge || null,
    grievance_officer: f.officer_name.trim()
      ? { name: f.officer_name, email: f.officer_email, phone: f.officer_phone }
      : null,
  };
}

/**
 * Running the storefront: on or off, the discounts, the shelf life an online
 * order's batch must have, the cap on H1 and habit-forming drugs, and who is
 * named on it. It opens only with the drug licence, a registered pharmacist
 * and a grievance officer on record.
 */
export function StorefrontSettings() {
  const canManage = useHasPermission(P.PHARMACY.STOREFRONT.MANAGE);
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: () => storefrontService.getStorefrontSettings(),
    enabled: canManage,
  });
  const pharmacists = useQuery({
    queryKey: ["storefront-pharmacists"],
    queryFn: () => storefrontService.listStorefrontPharmacists(),
    enabled: canManage,
  });
  const save = useMutation({
    mutationFn: (f: Form) => storefrontService.updateStorefrontSettings(toSettings(f)),
    onSuccess: () => {
      toast.success("Storefront settings saved");
      void queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    values: settings.data ? toForm(settings.data) : undefined,
  });
  if (!canManage) return null;
  if (settings.isError) {
    return (
      <Alert tone="danger" title="Storefront settings could not be loaded">
        Try again in a moment.
      </Alert>
    );
  }
  const num = (name: keyof Form, label: string, description?: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberField
          label={label}
          description={description}
          min={0}
          value={field.value as number}
          onChange={(v) => field.onChange(Number(v))}
        />
      )}
    />
  );
  return (
    <Card padding="md">
      <Stack component="form" gap="sm" onSubmit={handleSubmit((f) => save.mutate(f))}>
        <Text fw={600} size="sm">
          Online storefront
        </Text>
        {settings.data && !settings.data.open && (
          <Alert tone="info" title="Not open to patients yet">
            Still needed: {(settings.data.missing ?? []).join(", ")}.
          </Alert>
        )}
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Switch
              label="Take orders online"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {num("rx", "Discount on prescription medicines (%)")}
          {num("otc", "Discount on other medicines (%)")}
          {num("min_shelf_life_days", "Shelf life left at dispatch (days)")}
          {num("restricted_max_units", "H1 and habit-forming: units per order")}
          {num("return_window_days", "Returns accepted for (days)")}
        </SimpleGrid>
        <Controller
          control={control}
          name="pharmacist_in_charge"
          render={({ field }) => (
            <Select
              label="Pharmacist in charge"
              description="Named, with their registration, on the storefront"
              searchable
              data={(pharmacists.data ?? []).map((p) => ({
                value: p.id,
                label: p.registration_number
                  ? `${p.full_name} · ${p.registration_number}`
                  : `${p.full_name} · no registration on record`,
              }))}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
        <Group grow>
          <Controller
            control={control}
            name="officer_name"
            render={({ field }) => <Input label="Grievance officer" {...field} />}
          />
          <Controller
            control={control}
            name="officer_email"
            render={({ field }) => <Input label="Email" type="email" {...field} />}
          />
          <Controller
            control={control}
            name="officer_phone"
            render={({ field }) => <Input label="Phone" inputMode="tel" {...field} />}
          />
        </Group>
        <Button type="submit" tone="primary" loading={save.isPending}>
          Save
        </Button>
      </Stack>
    </Card>
  );
}
