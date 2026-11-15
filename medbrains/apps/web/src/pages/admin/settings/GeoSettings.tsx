import { Divider, Group, Loader, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useLocaleProfile, useLocaleStore } from "@medbrains/stores";
import type { GeoCountry, GeoDistrict, GeoState } from "@medbrains/types";
import {
  IconCheck,
  IconDeviceFloppy,
  IconInfoCircle,
  IconMapPin,
  IconSearch,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PinCodeInput } from "@/components/PinCodeInput";
import { Button } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

// ── GeoSettings ──────────────────────────────────────────

export function GeoSettings() {
  const queryClient = useQueryClient();

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

  // ── Load current tenant data (for context; geo IDs not on TenantSummary) ──

  useQuery({
    queryKey: ["setup-tenant"],
    queryFn: () => tenantSettingsService.getTenant(),
    staleTime: 60_000,
  });

  // ── Geo: Countries ──────────────────────────────────────

  const { data: countries, isLoading: countriesLoading } = useQuery({
    queryKey: ["geo-countries"],
    queryFn: () => tenantSettingsService.geoCountries(),
    staleTime: 5 * 60_000,
  });

  // A country the profile holds is changed on Locale profile (a second person
  // approves it); here it is shown, not offered: the server refuses a change.
  const profileCountry = useLocaleProfile()?.values.country;
  const lockedCountryId = useMemo(
    () => countries?.find((c: GeoCountry) => c.code === profileCountry)?.id ?? null,
    [countries, profileCountry],
  );
  const countryId = lockedCountryId ?? selectedCountryId;

  const countryOptions = (countries ?? []).map((c: GeoCountry) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));

  // ── Geo: States (dependent on country) ─────────────────

  const { data: states, isLoading: statesLoading } = useQuery({
    queryKey: ["geo-states", countryId],
    queryFn: () => tenantSettingsService.geoStates(countryId ?? ""),
    enabled: !!countryId,
    staleTime: 5 * 60_000,
  });

  const stateOptions = (states ?? []).map((s: GeoState) => ({
    value: s.id,
    label: `${s.name} (${s.code})`,
  }));

  // ── Geo: Districts (dependent on state) ────────────────

  const { data: districts, isLoading: districtsLoading } = useQuery({
    queryKey: ["geo-districts", selectedStateId],
    queryFn: () => tenantSettingsService.geoDistricts(selectedStateId ?? ""),
    enabled: !!selectedStateId,
    staleTime: 5 * 60_000,
  });

  const districtOptions = (districts ?? []).map((d: GeoDistrict) => ({
    value: d.id,
    label: `${d.name} (${d.code})`,
  }));

  // ── Save Geo Mutation ──────────────────────────────────

  const saveGeoMutation = useMutation({
    mutationFn: () =>
      tenantSettingsService.updateTenantGeo({
        country_id: profileCountry ? undefined : (selectedCountryId ?? undefined),
        state_id: selectedStateId ?? undefined,
        district_id: selectedDistrictId ?? undefined,
      }),
    onSuccess: (result) => {
      notifications.show({
        title: "Geography saved",
        message: "Tenant geography settings have been updated",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-tenant"] });

      if (result.defaults_applied) {
        // Refresh locale settings in store
        Promise.all([
          tenantSettingsService.getTenantSettings("units"),
          tenantSettingsService.getTenantSettings("locale"),
        ])
          .then(([units, locale]) => {
            useLocaleStore.getState().setFromTenantSettings(
              [...units, ...locale].map((r) => ({
                category: r.category,
                key: r.key,
                value: r.value,
              })),
            );
          })
          // The defaults are saved; only this screen's copy is stale until reload.
          .catch(() =>
            notifications.show({
              title: "Reload to see the new units",
              message: "The defaults were saved, but this screen could not read them back.",
              color: "yellow",
            }),
          );

        void queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });

        notifications.show({
          title: "Defaults auto-configured",
          message:
            "Measurement units and date format came from the country, and its time zone and currency became the locale profile. Change units on Units & Locale, and the profile on Locale profile.",
          color: "primary",
          icon: <IconInfoCircle size={16} />,
          autoClose: 6000,
        });
      }
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Handlers ───────────────────────────────────────────

  const handleCountryChange = (value: string | null) => {
    setSelectedCountryId(value);
    setSelectedStateId(null);
    setSelectedDistrictId(null);
  };

  const handleStateChange = (value: string | null) => {
    setSelectedStateId(value);
    setSelectedDistrictId(null);
  };

  const handleDistrictChange = (value: string | null) => {
    setSelectedDistrictId(value);
  };

  const handleSave = () => {
    saveGeoMutation.mutate();
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <Stack gap="lg">
      <div>
        <Group gap="xs" mb="xs">
          <IconMapPin size={20} />
          <Text fw={600} size="lg">
            Geo Selection
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Set the country, state, and district for your hospital tenant. This determines applicable
          regulatory bodies and locale defaults.
        </Text>
      </div>

      <Stack gap="md" maw={480}>
        <Select
          label="Country"
          placeholder={profileCountry ?? "Select country"}
          data={countryOptions}
          value={countryId}
          onChange={handleCountryChange}
          searchable
          clearable={!profileCountry}
          disabled={profileCountry !== undefined}
          description={
            profileCountry
              ? "Part of the locale profile: change it in Settings, Locale profile, where a second person approves it."
              : "Set once here; after that it changes on Locale profile."
          }
          rightSection={countriesLoading ? <Loader size={16} /> : undefined}
          nothingFoundMessage="No countries found"
        />

        <Select
          label="State"
          placeholder={countryId ? "Select state" : "Select a country first"}
          data={stateOptions}
          value={selectedStateId}
          onChange={handleStateChange}
          searchable
          clearable
          disabled={!countryId}
          rightSection={statesLoading ? <Loader size={16} /> : undefined}
          nothingFoundMessage="No states found"
        />

        <Select
          label="District"
          placeholder={selectedStateId ? "Select district" : "Select a state first"}
          data={districtOptions}
          value={selectedDistrictId}
          onChange={handleDistrictChange}
          searchable
          clearable
          disabled={!selectedStateId}
          rightSection={districtsLoading ? <Loader size={16} /> : undefined}
          nothingFoundMessage="No districts found"
        />
      </Stack>

      <Group>
        <Button
          tone="primary"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={saveGeoMutation.isPending}
          disabled={!countryId}
        >
          Save Geography
        </Button>
      </Group>

      <Divider my="md" />

      <div>
        <Group gap="xs" mb="xs">
          <IconSearch size={20} />
          <Text fw={600} size="lg">
            PIN Code Lookup
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Enter a PIN code to find the corresponding town, sub-district, district, state, and
          country. Click a result to auto-fill the geography selectors above.
        </Text>
      </div>

      <Stack maw={720}>
        <PinCodeInput
          onSelect={(result) => {
            setSelectedCountryId(result.country_id);
            setSelectedStateId(result.state_id);
            setSelectedDistrictId(result.district_id);
          }}
        />
      </Stack>
    </Stack>
  );
}
