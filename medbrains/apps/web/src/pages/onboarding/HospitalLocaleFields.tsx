import { Select } from "@mantine/core";
import type { UpdateTenantInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { MONTH_OPTIONS } from "@/pages/admin/settings/locale-profile/fields";
import { onboardingService } from "@/services/onboarding.service";

/** Every zone or currency the browser's Intl knows, with `current` kept if it lists it under another name. */
function intlOptions(kind: "timeZone" | "currency", current?: string | null) {
  const all = Intl.supportedValuesOf(kind);
  const values = current && !all.includes(current) ? [current, ...all] : all;
  return values.map((v) => ({ value: v, label: v }));
}

/**
 * The hospital step's time zone, currency and financial-year fields. Each may
 * be left empty: the country chosen on the Geography step decides it.
 */
export function HospitalLocaleFields({ form }: { form: UseFormReturn<UpdateTenantInput> }) {
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

  return (
    <>
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
    </>
  );
}
