import { Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type LabTestCatalog, P } from "@medbrains/types";
import { IconMicroscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { lookupsService } from "../services/lookups.service";
import { MiniAddLabTest } from "./Lab/MiniAddLabTest";
import { SearchOrCreate } from "./SearchOrCreate";

interface LabTestSearchSelectProps {
  value: string;
  onChange: (testId: string, test?: LabTestCatalog) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
}

export function LabTestSearchSelect({
  value,
  onChange,
  label = "Lab Test",
  placeholder = "Search by test name, code, or LOINC...",
  required,
  size = "sm",
  error,
}: LabTestSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const canCreateTest = useHasPermission(P.LAB.ORDERS_CREATE);

  const { data } = useQuery({
    queryKey: ["lab-test-search", debounced],
    queryFn: () => lookupsService.listLabCatalog({ search: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const tests = data ?? [];

  return (
    <SearchOrCreate
      value={value}
      label={label}
      placeholder={placeholder}
      required={required}
      size={size}
      error={error}
      leftSection={<IconMicroscope size={14} />}
      items={tests.slice(0, 15)}
      searchText={search}
      onSearchChange={setSearch}
      getItemValue={(test) => test.id}
      getItemDisplay={(test) => `${test.name} (${test.code})`}
      onSelect={(test) => onChange(test.id, test)}
      onClear={() => onChange("")}
      emptyLabel="No tests found"
      canCreate={canCreateTest}
      createButtonLabel="Add lab test"
      createButtonIcon={<IconMicroscope size={14} />}
      createModalTitle="Add lab test"
      renderItem={(t) => (
        <Group gap={8} wrap="nowrap" justify="space-between">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {t.name}
            </Text>
            <Group gap={6}>
              <Text size="xs" c="primary" fw={600}>
                {t.code}
              </Text>
              {t.loinc_code && (
                <Text size="xs" c="dimmed">
                  LOINC: {t.loinc_code}
                </Text>
              )}
            </Group>
          </div>
          <Text size="xs" fw={600} c="primary">
            {"\u20B9"}
            {t.price}
          </Text>
        </Group>
      )}
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniAddLabTest searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
}
