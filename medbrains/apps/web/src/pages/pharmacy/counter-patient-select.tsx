/**
 * Find the registered patient a counter sale belongs to.
 *
 * The full patient search is a clinical read the counter is not granted, so a
 * pharmacist got "Patient search restricted" and every sale went out as a
 * walk-in. This asks the counter's own endpoint, which answers name, UHID,
 * age and sex — enough to pick the right person, nothing of their chart.
 */
import { Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { CounterPatient } from "@medbrains/types";
import { IconUser } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchOrCreate } from "@/components/SearchOrCreate";
import { pharmacyService } from "@/services/pharmacy.service";

/** The server searches from three characters; fewer match half the register. */
const MIN_SEARCH = 3;

function describePatient(patient: CounterPatient): string {
  const facts = [patient.age_years != null ? `${patient.age_years}y` : null, patient.gender]
    .filter(Boolean)
    .join(" ");
  return `${patient.full_name} · ${patient.uhid}${facts ? ` · ${facts}` : ""}`;
}

interface CounterPatientSelectProps {
  value: string;
  onChange: (patientId: string) => void;
  error?: string;
}

export function CounterPatientSelect({ value, onChange, error }: CounterPatientSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const { data = [], isError } = useQuery({
    queryKey: ["counter-patients", debounced],
    queryFn: () => pharmacyService.searchCounterPatients(debounced),
    enabled: debounced.trim().length >= MIN_SEARCH,
    staleTime: 30_000,
  });

  return (
    <SearchOrCreate
      value={value}
      label="Registered patient"
      placeholder="Name, UHID or phone"
      size="xs"
      error={error ?? (isError ? "Patient search failed — try again" : undefined)}
      leftSection={<IconUser size={14} />}
      items={data}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={MIN_SEARCH}
      typeToSearchLabel="Type at least 3 characters..."
      getItemValue={(patient) => patient.id}
      getItemDisplay={describePatient}
      onSelect={(patient) => onChange(patient.id)}
      onClear={() => onChange("")}
      emptyLabel="No patient found"
      renderItem={(patient) => <Text size="sm">{describePatient(patient)}</Text>}
    />
  );
}
