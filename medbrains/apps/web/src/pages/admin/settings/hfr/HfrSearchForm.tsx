/**
 * The HFR search form (HFR-001…007): by facility ID if the campus already has
 * one, otherwise by name, ownership and place. Validated before anything is
 * sent; the search itself is the caller's.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { HfrFacilitySearch } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { Button, Input, Select } from "@/components/ui";
import { HfrLgdSelects } from "./HfrLgdSelects";
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

interface HfrSearchFormProps {
  defaultName: string;
  searching: boolean;
  onSearch: (q: HfrFacilitySearch) => void;
}

/** The search fields and the "Search HFR" button. */
export function HfrSearchForm({ defaultName, searching, onSearch }: HfrSearchFormProps) {
  const { control, handleSubmit, register, watch, setValue, formState } =
    useForm<HfrFacilitySearch>({
      resolver: zodResolver(searchSchema),
      defaultValues: { ...EMPTY_SEARCH, facilityName: defaultName },
    });
  const [state, district, sub] = watch(["stateLGDCode", "districtLGDCode", "subDistrictLGDCode"]);
  const owners = useHfrMaster("data", "OWNER");
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
        <HfrLgdSelects
          value={{ stateLGDCode: state, districtLGDCode: district, subDistrictLGDCode: sub }}
          onChange={(field, code) => setValue(field, code)}
          errors={{ stateLGDCode: errors.stateLGDCode?.message }}
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
          loading={searching}
          onClick={() => void handleSubmit((q) => onSearch(q))()}
        >
          Search HFR
        </Button>
      </Group>
    </Stack>
  );
}
