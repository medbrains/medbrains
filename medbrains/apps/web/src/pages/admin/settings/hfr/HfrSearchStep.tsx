/**
 * Step 1 — search HFR before registering (HFR-001…009). Creating a facility
 * HFR already lists gives the registry two records that nothing merges, so
 * "register new" opens only after a search has run. A hit can be linked to
 * this campus instead.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { HfrFacilitySearch, HfrSearchPage } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Input, Select, Table } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { searchSchema } from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

const EMPTY_SEARCH: HfrFacilitySearch = {
  facilityId: "",
  facilityName: "",
  ownershipCode: "",
  stateLGDCode: "",
  districtLGDCode: "",
  subDistrictLGDCode: "",
  pincode: "",
};

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
  const { control, handleSubmit, register, watch, setValue, formState } =
    useForm<HfrFacilitySearch>({
      resolver: zodResolver(searchSchema),
      defaultValues: { ...EMPTY_SEARCH, facilityName: defaultName },
    });
  const search = useMutation({
    mutationFn: (q: HfrFacilitySearch) => abdmRegistryService.searchHfrFacilities(q),
  });
  const [state, district] = watch(["stateLGDCode", "districtLGDCode"]);
  const owners = useHfrMaster("data", "OWNER");
  const states = useHfrMaster("states");
  const districts = useHfrMaster("districts", state, "", state !== "");
  const subDistricts = useHfrMaster("sub-districts", district, "", district !== "");
  const { errors } = formState;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Search HFR first: by the facility ID if this campus already has one, otherwise by name,
        ownership and state.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        <Input
          label="HFR facility ID"
          placeholder="IN2710000123"
          error={errors.facilityId?.message}
          {...register("facilityId")}
        />
        <Input
          label="Facility name"
          description="Full or part of the name"
          error={errors.facilityName?.message}
          {...register("facilityName")}
        />
        <Controller
          control={control}
          name="ownershipCode"
          render={({ field }) => (
            <Select
              label="Ownership"
              placeholder="Select ownership"
              data={owners.data}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.ownershipCode?.message ?? owners.error}
            />
          )}
        />
        <Select
          label="State / UT"
          placeholder="Select State / UT"
          searchable
          data={states.data}
          value={state || null}
          onChange={(v) => {
            setValue("stateLGDCode", v ?? "");
            setValue("districtLGDCode", "");
            setValue("subDistrictLGDCode", "");
          }}
          error={errors.stateLGDCode?.message ?? states.error}
        />
        <Select
          label="District"
          placeholder="Select District"
          searchable
          data={districts.data}
          disabled={state === ""}
          value={district || null}
          onChange={(v) => {
            setValue("districtLGDCode", v ?? "");
            setValue("subDistrictLGDCode", "");
          }}
          error={districts.error}
        />
        <Controller
          control={control}
          name="subDistrictLGDCode"
          render={({ field }) => (
            <Select
              label="Sub-district"
              placeholder="Select Sub-District"
              searchable
              data={subDistricts.data}
              disabled={district === ""}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={subDistricts.error}
            />
          )}
        />
        <Input
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          error={errors.pincode?.message}
          {...register("pincode")}
        />
      </SimpleGrid>
      <Group>
        <Button
          tone="primary"
          loading={search.isPending}
          onClick={() => void handleSubmit((q) => search.mutate(q))()}
        >
          Search HFR
        </Button>
      </Group>
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
