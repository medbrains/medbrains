import { Box, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type LabTestCatalog, P } from "@medbrains/types";
import { IconMicroscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchErrorText } from "@/lib/search-error";
import { lookupsService } from "@/services/lookups.service";
import { MiniAddLabTest } from "./Lab/MiniAddLabTest";
import { SearchOrCreate } from "./SearchOrCreate";

/** "T3", "K", "Na" are whole test codes — one character is a real search. */
const MIN_CHARS = 1;
const SEARCH_LIMIT = 25;

interface LabTestSearchSelectProps {
  value: string;
  onChange: (testId: string, test?: LabTestCatalog) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  /** Passed through to `SearchOrCreate`, which has always supported it. */
  disabled?: boolean;
  /** Empty the box after each pick — a counter adding test after test. */
  clearOnSelect?: boolean;
  size?: string;
  error?: string;
}

export function LabTestSearchSelect({
  value,
  onChange,
  label = "Lab Test",
  placeholder = "Search by test name, code, short name (CBC, LFT) or LOINC...",
  required,
  disabled,
  clearOnSelect,
  size = "sm",
  error,
}: LabTestSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const canCreateTest = useHasPermission(P.LAB.ORDERS_CREATE);

  // The server ranks (exact code/short name > prefix > word > contains >
  // fuzzy), drops retired tests and caps the list — the picker shows it as is.
  const query = debounced.trim();
  const {
    data,
    isFetching,
    error: searchError,
  } = useQuery({
    queryKey: ["lab-test-search", query],
    queryFn: () => lookupsService.listLabCatalog({ search: query, limit: String(SEARCH_LIMIT) }),
    enabled: query.length >= MIN_CHARS,
    staleTime: 60_000,
  });

  const tests = data ?? [];
  const isSearching = isFetching || search.trim() !== query;

  return (
    <SearchOrCreate
      value={value}
      label={label}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      clearOnSelect={clearOnSelect}
      size={size}
      error={error}
      leftSection={<IconMicroscope size={14} />}
      items={tests}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={MIN_CHARS}
      loading={isSearching}
      fetchError={searchErrorText(searchError, "lab tests")}
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
          <Box flex={1}>
            <Text size="sm" fw={500}>
              {t.name}
            </Text>
            <Group gap={6}>
              <Text size="xs" c="primary" fw={600}>
                {t.code}
              </Text>
              {t.sample_type && (
                <Text size="xs" c="dimmed">
                  {t.sample_type}
                </Text>
              )}
              {t.loinc_code && (
                <Text size="xs" c="dimmed">
                  LOINC: {t.loinc_code}
                </Text>
              )}
            </Group>
          </Box>
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
