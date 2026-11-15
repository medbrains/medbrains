/**
 * Step 2 — basic information (HFR-010…038; on update HFR-064…092), saved
 * with the facility manager's HPR sign-in. The first save returns the
 * trackingId every later step carries.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Divider, SimpleGrid, Stack, Text } from "@mantine/core";
import type { HfrFacilityInformation, HfrStepSaved } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Controller, type UseFormReturn, useForm } from "react-hook-form";
import { Alert, Button, Input, MultiSelect, Select } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { HfrBasicContacts, HfrBasicLocation } from "./HfrBasicLocation";
import { HfrWorkingDays } from "./HfrWorkingDays";
import {
  type BasicForm,
  basicSchema,
  needsTypeOfService,
  OWNERSHIP_GOVERNMENT,
  SUBTYPE_CENTRAL,
  toFacilityInformation,
} from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

interface HfrBasicStepProps {
  facilityId: string;
  initial: BasicForm;
  signedIn: boolean;
  /** `typeName` is the facility type's HFR name, which later rules need. */
  onSaved: (saved: HfrStepSaved, info: HfrFacilityInformation, typeName: string) => void;
}

/** The basic information form and its save. */
export function HfrBasicStep({ facilityId, initial, signedIn, onSaved }: HfrBasicStepProps) {
  const form = useForm<BasicForm>({ resolver: zodResolver(basicSchema), defaultValues: initial });
  const { register, watch, formState } = form;
  const [ownership, systems, typeCode] = watch([
    "ownershipCode",
    "systemsOfMedicine",
    "facilityTypeCode",
  ]);
  const types = useHfrMaster(
    "facility-types",
    ownership,
    systems.join(","),
    ownership !== "" && systems.length > 0,
  );
  const subTypes = useHfrMaster("facility-sub-types", typeCode, "", typeCode !== "");
  const save = useMutation({
    mutationFn: (info: HfrFacilityInformation) =>
      abdmRegistryService.saveHfrBasic(facilityId, info),
    onSuccess: (saved, info) => onSaved(saved, info, form.getValues("facilityTypeName")),
  });

  /** Record what the master lists say about the type, then validate and save. */
  const submit = () => {
    const typeName = types.data.find((t) => t.value === typeCode)?.label ?? "";
    form.setValue("facilityTypeName", typeName);
    form.setValue("hasSubTypes", subTypes.data.length > 0);
    void form.handleSubmit((b) => save.mutate(toFacilityInformation(b)))();
  };

  return (
    <Stack gap="md">
      <Input
        label="Facility name"
        withAsterisk
        error={formState.errors.facilityName?.message}
        {...register("facilityName")}
      />
      <OwnershipSection form={form} />
      <Divider />
      <Text fw={600}>Medicine, type and services</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <MasterMulti
          form={form}
          name="systemsOfMedicine"
          label="System of medicine"
          kind="MEDICINE"
          required
        />
        <MasterMulti
          form={form}
          name="typesOfService"
          label="Type of service"
          kind="SPECIALITY-TYPE"
          required={needsTypeOfService(types.data.find((t) => t.value === typeCode)?.label ?? "")}
        />
        <Controller
          control={form.control}
          name="facilityTypeCode"
          render={({ field, fieldState }) => (
            <Select
              label="Facility type"
              withAsterisk
              placeholder={
                ownership && systems.length
                  ? "Select facility type"
                  : "Choose ownership and system of medicine first"
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
      </SimpleGrid>
      <Divider />
      <HfrBasicLocation form={form} />
      <Divider />
      <HfrWorkingDays form={form} />
      <Divider />
      <HfrBasicContacts form={form} />
      {save.isError && (
        <Alert tone="danger" title="HFR did not save basic information">
          {save.error.message}
        </Alert>
      )}
      <Button tone="primary" disabled={!signedIn} loading={save.isPending} onClick={submit}>
        {signedIn ? "Save basic information" : "Sign in to HPR to save"}
      </Button>
    </Stack>
  );
}

interface SectionProps {
  form: UseFormReturn<BasicForm>;
}

/** Ownership, its conditional subtypes (HFR-031…033) and the status (HFR-022). */
function OwnershipSection({ form }: SectionProps) {
  const [ownership, subtype] = form.watch(["ownershipCode", "ownershipSubTypeCode"]);
  const government = ownership === OWNERSHIP_GOVERNMENT;
  const central = government && subtype === SUBTYPE_CENTRAL;
  const owners = useHfrMaster("data", "OWNER");
  const statuses = useHfrMaster("data", "FAC-STATUS");
  const subtypes = useHfrMaster("owner-subtypes", ownership, "", government);
  const ministries = useHfrMaster("data", "CENTRAL-GOVERNMENT", "", central);
  const pick = (
    name: keyof BasicForm,
    label: string,
    list: ReturnType<typeof useHfrMaster>,
    onPick?: () => void,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={label}
          withAsterisk
          data={list.data}
          value={typeof field.value === "string" && field.value ? field.value : null}
          onChange={(v) => {
            field.onChange(v ?? "");
            onPick?.();
          }}
          error={fieldState.error?.message ?? list.error}
        />
      )}
    />
  );
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
      {pick("operationalStatus", "Operational status", statuses)}
      {pick("ownershipCode", "Ownership", owners, () => {
        form.setValue("ownershipSubTypeCode", "");
        form.setValue("ownershipSubTypeCode2", "");
        form.setValue("facilityTypeCode", "");
      })}
      {government &&
        pick("ownershipSubTypeCode", "Government subtype", subtypes, () =>
          form.setValue("ownershipSubTypeCode2", ""),
        )}
      {central && pick("ownershipSubTypeCode2", "Central government ministry", ministries)}
    </SimpleGrid>
  );
}

interface MasterMultiProps extends SectionProps {
  name: "systemsOfMedicine" | "typesOfService";
  label: string;
  kind: string;
  required: boolean;
}

/** A multi-choice filled from one `get-master-data` type. */
function MasterMulti({ form, name, label, kind, required }: MasterMultiProps) {
  const list = useHfrMaster("data", kind);
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <MultiSelect
          label={label}
          withAsterisk={required}
          searchable
          data={list.data}
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message ?? list.error}
        />
      )}
    />
  );
}
