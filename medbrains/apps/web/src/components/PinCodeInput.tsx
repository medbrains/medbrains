import { Alert, Badge, Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import type { PincodeResult } from "@medbrains/types";
import { IconMapPin, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { lookupsService } from "@/services/lookups.service";

interface PinCodeInputProps {
  /** Called when the user selects a result row. */
  onSelect?: (result: PincodeResult) => void;
}

export function PinCodeInput({ onSelect }: PinCodeInputProps) {
  const [pincode, setPincode] = useState("");
  const trimmed = pincode.trim();
  const enabled = trimmed.length >= 4;

  const {
    data: results,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["geo-pincode", trimmed],
    queryFn: () => lookupsService.searchPincode(trimmed),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Stack gap="sm">
      <TextInput
        label="PIN Code Lookup"
        placeholder="Enter PIN code (e.g. 560001)"
        leftSection={<IconSearch size={16} />}
        value={pincode}
        onChange={(e) => setPincode(e.currentTarget.value)}
        maxLength={10}
      />

      {isLoading && enabled && (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Searching...
          </Text>
        </Group>
      )}

      {isError && (
        <Alert color="danger" variant="light">
          Failed to lookup PIN code. Please try again.
        </Alert>
      )}

      {results && results.length === 0 && enabled && !isLoading && (
        <Text size="sm" c="dimmed">
          No locations found for PIN code "{trimmed}".
        </Text>
      )}

      {results && results.length > 0 && (
        <DataTable
          columns={[
            {
              key: "town",
              label: "Town",
              render: (r: PincodeResult) => (
                <Group gap={6}>
                  <IconMapPin size={14} color="var(--mantine-color-blue-6)" />
                  <Text size="sm">{r.town_name}</Text>
                </Group>
              ),
            },
            {
              key: "subdistrict",
              label: "Subdistrict",
              render: (r: PincodeResult) => <Text size="sm">{r.subdistrict_name}</Text>,
            },
            {
              key: "district",
              label: "District",
              render: (r: PincodeResult) => <Text size="sm">{r.district_name}</Text>,
            },
            {
              key: "state",
              label: "State",
              render: (r: PincodeResult) => <Text size="sm">{r.state_name}</Text>,
            },
            {
              key: "country",
              label: "Country",
              render: (r: PincodeResult) => (
                <Badge variant="light" size="sm">
                  {r.country_name}
                </Badge>
              ),
            },
          ]}
          data={results}
          rowKey={(r) => r.town_id}
          onRowClick={onSelect ? (r) => onSelect(r) : undefined}
        />
      )}
    </Stack>
  );
}
