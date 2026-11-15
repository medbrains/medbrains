/**
 * Basic information — where the campus is and how the public reaches it
 * (HFR-011…019, HFR-023…026). Country is India and locked (HFR-013); state,
 * district and sub-district come from HFR's LGD lists and send LGD codes.
 */

import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconCurrentLocation } from "@tabler/icons-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Alert, Button, Input, Select } from "@/components/ui";
import { type BasicForm, COUNTRY } from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

/** HFR-011/012 allow at most six decimal places. */
const COORD_DECIMALS = 6;

interface SectionProps {
  form: UseFormReturn<BasicForm>;
}

/** Address, LGD codes, pincode and coordinates. */
export function HfrBasicLocation({ form }: SectionProps) {
  const { register, watch, setValue, formState } = form;
  const { errors } = formState;
  const [state, district, sub] = watch(["stateLGDCode", "districtLGDCode", "subDistrictLGDCode"]);
  const states = useHfrMaster("states");
  const districts = useHfrMaster("districts", state, "", state !== "");
  const subDistricts = useHfrMaster("sub-districts", district, "", district !== "");
  const [locError, setLocError] = useState<string | null>(null);

  /** Fill the coordinates from this device (HFR-011/012). */
  const fillFromDevice = () => {
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValue("latitude", p.coords.latitude.toFixed(COORD_DECIMALS), { shouldValidate: true });
        setValue("longitude", p.coords.longitude.toFixed(COORD_DECIMALS), {
          shouldValidate: true,
        });
      },
      () => setLocError("This device did not share its location. Enter the coordinates."),
    );
  };

  return (
    <Stack gap="sm">
      <Text fw={600}>Location</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Input label="Country" value={COUNTRY} readOnly disabled />
        <Select
          label="State / UT"
          placeholder="Select State / UT"
          searchable
          withAsterisk
          data={states.data}
          value={state || null}
          onChange={(v) => {
            setValue("stateLGDCode", v ?? "", { shouldValidate: true });
            setValue("districtLGDCode", "");
            setValue("subDistrictLGDCode", "");
          }}
          error={errors.stateLGDCode?.message ?? states.error}
        />
        <Select
          label="District"
          placeholder="Select District"
          searchable
          withAsterisk
          disabled={state === ""}
          data={districts.data}
          value={district || null}
          onChange={(v) => {
            setValue("districtLGDCode", v ?? "", { shouldValidate: true });
            setValue("subDistrictLGDCode", "");
          }}
          error={errors.districtLGDCode?.message ?? districts.error}
        />
        <Select
          label="Sub-district"
          placeholder="Select Sub-District"
          searchable
          withAsterisk
          disabled={district === ""}
          data={subDistricts.data}
          value={sub || null}
          onChange={(v) => setValue("subDistrictLGDCode", v ?? "", { shouldValidate: true })}
          error={errors.subDistrictLGDCode?.message ?? subDistricts.error}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Input
          label="Address line 1"
          withAsterisk
          error={errors.addressLine1?.message}
          {...register("addressLine1")}
        />
        <Input
          label="Address line 2"
          error={errors.addressLine2?.message}
          {...register("addressLine2")}
        />
      </SimpleGrid>
      <Group align="flex-start" grow>
        <Input
          label="Pincode"
          withAsterisk
          inputMode="numeric"
          maxLength={6}
          error={errors.pincode?.message}
          {...register("pincode")}
        />
        <Input
          label="Latitude"
          withAsterisk
          placeholder="18.520430"
          error={errors.latitude?.message}
          {...register("latitude")}
        />
        <Input
          label="Longitude"
          withAsterisk
          placeholder="73.856743"
          error={errors.longitude?.message}
          {...register("longitude")}
        />
      </Group>
      <Group>
        <Button
          tone="ghost"
          leftSection={<IconCurrentLocation size={16} />}
          onClick={fillFromDevice}
        >
          Use this device's location
        </Button>
        {locError && <Alert tone="warning">{locError}</Alert>}
      </Group>
    </Stack>
  );
}

/** Public contacts, all optional, checked when filled (HFR-023…026). */
export function HfrBasicContacts({ form }: SectionProps) {
  const { register, formState } = form;
  const { errors } = formState;
  return (
    <Stack gap="sm">
      <Text fw={600}>Public contact (optional)</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Input
          label="Mobile number"
          inputMode="numeric"
          maxLength={10}
          error={errors.mobile?.message}
          {...register("mobile")}
        />
        <Group grow align="flex-start" gap="xs">
          <Input label="STD code" inputMode="numeric" maxLength={5} {...register("stdCode")} />
          <Input
            label="Landline"
            inputMode="numeric"
            maxLength={8}
            error={errors.landline?.message}
            {...register("landline")}
          />
        </Group>
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Input
          label="Website"
          placeholder="example.org"
          error={errors.website?.message}
          {...register("website")}
        />
      </SimpleGrid>
    </Stack>
  );
}
