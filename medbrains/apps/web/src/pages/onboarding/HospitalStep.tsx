import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, TextInput } from "@mantine/core";
import type { UpdateTenantInput } from "@medbrains/schemas";
import { updateTenantSchema } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { MONTH_OPTIONS } from "@/pages/admin/settings/locale-profile/fields";
import { onboardingService } from "@/services/onboarding.service";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

/** Every zone or currency the browser's Intl knows, with `current` kept if it lists it under another name. */
function intlOptions(kind: "timeZone" | "currency", current?: string | null) {
  const all = Intl.supportedValuesOf(kind);
  const values = current && !all.includes(current) ? [current, ...all] : all;
  return values.map((v) => ({ value: v, label: v }));
}

export function HospitalStep({ onNext, onBack }: Props) {
  const stored = useOnboardingStore((s) => s.hospitalDetails);
  const setHospitalDetails = useOnboardingStore((s) => s.setHospitalDetails);
  // The country chosen on the Geography step decides the starting zone and
  // currency; nothing here assumes one.
  const countryId = useOnboardingStore((s) => s.geo?.country_id);
  const countries = useQuery({
    queryKey: ["geo-countries"],
    queryFn: () => onboardingService.geoCountries(),
  });
  const country = useMemo(
    () => countries.data?.find((c) => c.id === countryId),
    [countries.data, countryId],
  );
  const fromCountry = country ? `${country.name}'s` : "the country's";

  const form = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema) as Resolver<UpdateTenantInput>,
    defaultValues: {
      address_line1: stored?.address_line1 ?? "",
      address_line2: stored?.address_line2 ?? "",
      city: stored?.city ?? "",
      pincode: stored?.pincode ?? "",
      phone: stored?.phone ?? "",
      email: stored?.email ?? "",
      website: stored?.website ?? "",
      registration_no: stored?.registration_no ?? "",
      accreditation: stored?.accreditation ?? "",
      timezone: stored?.timezone ?? null,
      currency: stored?.currency ?? null,
      fy_start_month: stored?.fy_start_month ?? null,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setHospitalDetails({
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      registration_no: data.registration_no || null,
      accreditation: data.accreditation || null,
      // Empty means "the country's": the server applies its presets.
      timezone: data.timezone || null,
      currency: data.currency || null,
      fy_start_month: data.fy_start_month ?? null,
    });
    onNext();
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <div className={classes.formGrid}>
          <TextInput
            label="Address Line 1"
            placeholder="Street address"
            {...form.register("address_line1")}
            error={form.formState.errors.address_line1?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="Address Line 2"
            placeholder="Locality / landmark"
            {...form.register("address_line2")}
            error={form.formState.errors.address_line2?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="City"
            placeholder="City"
            {...form.register("city")}
            error={form.formState.errors.city?.message}
          />
          <TextInput
            label="PIN Code"
            placeholder="600001"
            {...form.register("pincode")}
            error={form.formState.errors.pincode?.message}
          />
          <TextInput
            label="Phone"
            placeholder="+91 1234567890"
            {...form.register("phone")}
            error={form.formState.errors.phone?.message}
          />
          <TextInput
            label="Email"
            placeholder="info@hospital.com"
            {...form.register("email")}
            error={form.formState.errors.email?.message}
            type="email"
          />
          <TextInput
            label="Website"
            placeholder="https://hospital.com"
            {...form.register("website")}
            error={form.formState.errors.website?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="Registration Number"
            placeholder="Hospital registration number"
            {...form.register("registration_no")}
            error={form.formState.errors.registration_no?.message}
          />
          <TextInput
            label="Accreditation"
            placeholder="e.g., NABH, JCI"
            {...form.register("accreditation")}
            error={form.formState.errors.accreditation?.message}
          />
          <Controller
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <Select
                label="Time zone"
                description={`Empty uses ${fromCountry} zone`}
                placeholder={country?.default_timezone ?? "Choose the country first"}
                data={intlOptions("timeZone", field.value)}
                searchable
                clearable
                value={field.value ?? null}
                onChange={(v) => field.onChange(v)}
                error={form.formState.errors.timezone?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Select
                label="Currency"
                description={`Empty uses ${fromCountry} currency`}
                placeholder={country?.currency ?? "Choose the country first"}
                data={intlOptions("currency", field.value)}
                searchable
                clearable
                value={field.value || null}
                onChange={(v) => field.onChange(v)}
                error={form.formState.errors.currency?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="fy_start_month"
            render={({ field }) => (
              <Select
                label="Financial year starts"
                description={`Empty uses ${fromCountry} usual start`}
                placeholder="Country's usual start"
                data={MONTH_OPTIONS}
                clearable
                value={field.value ? String(field.value) : null}
                onChange={(v) => field.onChange(v ? Number(v) : null)}
                error={form.formState.errors.fy_start_month?.message}
              />
            )}
          />
        </div>

        <div className={classes.navButtons}>
          <Button tone="secondary" onClick={onBack}>
            Back
          </Button>
          <Button tone="primary" type="submit">
            Save & Continue
          </Button>
        </div>
      </Stack>
    </form>
  );
}
