/**
 * Basic information — the facility type and its subtype (HFR-034…036). The
 * type list hangs off the ownership and systems of medicine chosen above, so
 * it stays disabled until both are set; a new type clears the subtype.
 */

import { Controller, type UseFormReturn } from "react-hook-form";
import { Select } from "@/components/ui";
import type { BasicForm } from "./hfrRules";
import type { useHfrMaster } from "./useHfrMaster";

type MasterList = ReturnType<typeof useHfrMaster>;

interface HfrFacilityTypeSelectsProps {
  form: UseFormReturn<BasicForm>;
  types: MasterList;
  subTypes: MasterList;
  /** Ownership and at least one system of medicine are chosen. */
  hasParents: boolean;
}

/** The type and subtype selects; place them inside the caller's grid. */
export function HfrFacilityTypeSelects({
  form,
  types,
  subTypes,
  hasParents,
}: HfrFacilityTypeSelectsProps) {
  return (
    <>
      <Controller
        control={form.control}
        name="facilityTypeCode"
        render={({ field, fieldState }) => (
          <Select
            label="Facility type"
            withAsterisk
            placeholder={
              hasParents ? "Select facility type" : "Choose ownership and system of medicine first"
            }
            disabled={types.data.length === 0}
            data={types.data}
            value={field.value || null}
            onChange={(v) => {
              field.onChange(v ?? "");
              form.setValue("facilitySubType", "");
            }}
            error={fieldState.error?.message ?? types.error}
          />
        )}
      />
      <Controller
        control={form.control}
        name="facilitySubType"
        render={({ field, fieldState }) => (
          <Select
            label="Facility subtype"
            withAsterisk={subTypes.data.length > 0}
            disabled={subTypes.data.length === 0}
            data={subTypes.data}
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? "")}
            error={fieldState.error?.message ?? subTypes.error}
          />
        )}
      />
    </>
  );
}
