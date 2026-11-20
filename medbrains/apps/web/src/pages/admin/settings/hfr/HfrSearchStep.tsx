/**
 * Step 1 — search HFR before registering (HFR-001…009). Creating a facility
 * HFR already lists gives the registry two records that nothing merges, so
 * "register new" opens only after a search has run. A hit can be linked to
 * this campus instead.
 */

import { Group, Stack, Text } from "@mantine/core";
import type { HfrFacilitySearch, HfrSearchPage } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Table } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { HfrSearchForm } from "./HfrSearchForm";

interface HfrSearchStepProps {
  defaultName: string;
  canLink: boolean;
  linking: boolean;
  onLink: (facilityId: string) => void;
  onRegisterNew: () => void;
}

/** The search form, its results, and the two ways on. */
export function HfrSearchStep({
  defaultName,
  canLink,
  linking,
  onLink,
  onRegisterNew,
}: HfrSearchStepProps) {
  const search = useMutation({
    mutationFn: (q: HfrFacilitySearch) => abdmRegistryService.searchHfrFacilities(q),
  });

  return (
    <Stack gap="md">
      <HfrSearchForm
        defaultName={defaultName}
        searching={search.isPending}
        onSearch={(q) => search.mutate(q)}
      />
      {search.isError && (
        <Alert tone="danger" title="HFR search did not answer">
          {search.error.message} Nothing was registered; search again before registering.
        </Alert>
      )}
      {search.data && (
        <SearchResults
          page={search.data}
          canLink={canLink}
          linking={linking}
          onLink={onLink}
          onRegisterNew={onRegisterNew}
        />
      )}
    </Stack>
  );
}

interface SearchResultsProps {
  page: HfrSearchPage;
  canLink: boolean;
  linking: boolean;
  onLink: (facilityId: string) => void;
  onRegisterNew: () => void;
}

/** Hits with "link this", or a clear "none found", then "register new". */
function SearchResults({ page, canLink, linking, onLink, onRegisterNew }: SearchResultsProps) {
  return (
    <Stack gap="sm">
      {page.facilities.length === 0 ? (
        <Alert tone="info">HFR lists no facility that matches this search.</Alert>
      ) : (
        <Table aria-label="Facilities HFR already lists">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Facility ID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {page.facilities.map((f) => (
              <Table.Tr key={f.facility_id}>
                <Table.Td>{f.facility_id}</Table.Td>
                <Table.Td>{f.facility_name ?? "—"}</Table.Td>
                <Table.Td>{f.facility_status ?? "—"}</Table.Td>
                <Table.Td>{f.address ?? "—"}</Table.Td>
                <Table.Td>
                  {canLink && (
                    <Button
                      tone="secondary"
                      size="xs"
                      loading={linking}
                      onClick={() => onLink(f.facility_id)}
                    >
                      This is our campus — link it
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {page.total > page.facilities.length && (
        <Text size="sm" c="dimmed">
          HFR found {page.total}; the first {page.facilities.length} are shown. Narrow the search to
          see the rest.
        </Text>
      )}
      <Group>
        <Button tone="tertiary" onClick={onRegisterNew}>
          None of these — register this campus
        </Button>
      </Group>
    </Stack>
  );
}
