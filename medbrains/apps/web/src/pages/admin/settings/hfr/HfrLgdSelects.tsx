/**
 * State, district and sub-district, filled from HFR's LGD lists and sending
 * LGD codes. Shared by the search step and basic information, so both pick a
 * place the same way: a new state clears the district and sub-district, a new
 * district clears the sub-district.
 */

import { Select } from "@/components/ui";
import { useHfrMaster } from "./useHfrMaster";

/** The three LGD code fields both forms hold. */
export type LgdField = "stateLGDCode" | "districtLGDCode" | "subDistrictLGDCode";

interface HfrLgdSelectsProps {
  value: Record<LgdField, string>;
  /** `picked` is true for the field the user chose, false for a cleared child. */
  onChange: (field: LgdField, code: string, picked: boolean) => void;
  errors?: Partial<Record<LgdField, string>>;
  required?: boolean;
}

/** The three LGD selects; place them inside the caller's grid. */
export function HfrLgdSelects({
  value,
  onChange,
  errors = {},
  required = false,
}: HfrLgdSelectsProps) {
  const { stateLGDCode: state, districtLGDCode: district, subDistrictLGDCode: sub } = value;
  const states = useHfrMaster("states");
  const districts = useHfrMaster("districts", state, "", state !== "");
  const subDistricts = useHfrMaster("sub-districts", district, "", district !== "");
  return (
    <>
      <Select
        label="State / UT"
        placeholder="Select State / UT"
        searchable
        withAsterisk={required}
        data={states.data}
        value={state || null}
        onChange={(v) => {
          onChange("stateLGDCode", v ?? "", true);
          onChange("districtLGDCode", "", false);
          onChange("subDistrictLGDCode", "", false);
        }}
        error={errors.stateLGDCode ?? states.error}
      />
      <Select
        label="District"
        placeholder="Select District"
        searchable
        withAsterisk={required}
        disabled={state === ""}
        data={districts.data}
        value={district || null}
        onChange={(v) => {
          onChange("districtLGDCode", v ?? "", true);
          onChange("subDistrictLGDCode", "", false);
        }}
        error={errors.districtLGDCode ?? districts.error}
      />
      <Select
        label="Sub-district"
        placeholder="Select Sub-District"
        searchable
        withAsterisk={required}
        disabled={district === ""}
        data={subDistricts.data}
        value={sub || null}
        onChange={(v) => onChange("subDistrictLGDCode", v ?? "", true)}
        error={errors.subDistrictLGDCode ?? subDistricts.error}
      />
    </>
  );
}
