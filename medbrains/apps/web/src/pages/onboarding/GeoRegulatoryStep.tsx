import { Checkbox, Loader, Select, Stack, Text, Title } from "@mantine/core";
import { useOnboardingStore } from "@medbrains/stores";
import type { RegulatoryBody } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { onboardingService } from "@/services/onboarding.service";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function GeoRegulatoryStep({ onNext, onBack }: Props) {
  const storedGeo = useOnboardingStore((s) => s.geo);
  const storedRegulatorIds = useOnboardingStore((s) => s.regulatorIds);
  const setGeo = useOnboardingStore((s) => s.setGeo);

  const [countryId, setCountryId] = useState<string | null>(storedGeo?.country_id ?? null);
  const [stateId, setStateId] = useState<string | null>(storedGeo?.state_id ?? null);
  const [districtId, setDistrictId] = useState<string | null>(storedGeo?.district_id ?? null);
  const [selectedRegulators, setSelectedRegulators] = useState<string[]>(storedRegulatorIds);

  const { data: countries } = useQuery({
    queryKey: ["geo-countries"],
    queryFn: () => onboardingService.geoCountries(),
  });

  const { data: states } = useQuery({
    queryKey: ["geo-states", countryId],
    queryFn: () => onboardingService.geoStates(countryId as string),
    enabled: !!countryId,
  });

  const { data: districts } = useQuery({
    queryKey: ["geo-districts", stateId],
    queryFn: () => onboardingService.geoDistricts(stateId as string),
    enabled: !!stateId,
  });

  const { data: autoDetected, isLoading: detectingRegulators } = useQuery({
    queryKey: ["geo-regulators-auto", countryId, stateId],
    queryFn: () =>
      onboardingService.geoAutoDetectRegulators({
        country_id: countryId ?? undefined,
        state_id: stateId ?? undefined,
      }),
    enabled: !!countryId,
  });

  // Auto-select regulators only if none were previously stored
  useEffect(() => {
    if (autoDetected?.regulators && storedRegulatorIds.length === 0) {
      setSelectedRegulators(autoDetected.regulators.map((r: RegulatoryBody) => r.id));
    }
  }, [autoDetected, storedRegulatorIds.length]);

  // Reset cascading selects
  const handleCountryChange = (value: string | null) => {
    setCountryId(value);
    setStateId(null);
    setDistrictId(null);
  };

  const handleStateChange = (value: string | null) => {
    setStateId(value);
    setDistrictId(null);
  };

  const toggleRegulator = (id: string) => {
    setSelectedRegulators((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleSave = () => {
    setGeo(
      {
        country_id: countryId ?? undefined,
        state_id: stateId ?? undefined,
        district_id: districtId ?? undefined,
      },
      selectedRegulators,
    );
    onNext();
  };

  return (
    <Stack gap="md">
      <div className={classes.formGrid}>
        <Select
          label="Country"
          placeholder="Select country"
          data={countries?.map((c) => ({ value: c.id, label: c.name })) ?? []}
          value={countryId}
          onChange={handleCountryChange}
          searchable
        />
        <Select
          label="State / UT"
          placeholder="Select state"
          data={states?.map((s) => ({ value: s.id, label: s.name })) ?? []}
          value={stateId}
          onChange={handleStateChange}
          searchable
          disabled={!countryId}
        />
        <Select
          label="District"
          placeholder="Select district"
          data={districts?.map((d) => ({ value: d.id, label: d.name })) ?? []}
          value={districtId}
          onChange={setDistrictId}
          searchable
          disabled={!stateId}
        />
      </div>

      <div>
        <Title order={5} mb="sm">
          Applicable Regulatory Bodies
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Based on your location, these regulatory bodies are auto-detected. Adjust as needed.
        </Text>

        {detectingRegulators && <Loader size="sm" />}

        {autoDetected?.regulators.map((reg: RegulatoryBody) => (
          <Checkbox
            key={reg.id}
            label={`${reg.code} — ${reg.name}`}
            description={reg.description ?? undefined}
            checked={selectedRegulators.includes(reg.id)}
            onChange={() => toggleRegulator(reg.id)}
            mb="xs"
          />
        ))}
      </div>

      <div className={classes.navButtons}>
        <Button tone="secondary" onClick={onBack}>
          Back
        </Button>
        <Button tone="primary" onClick={handleSave}>
          Save & Continue
        </Button>
      </div>
    </Stack>
  );
}
