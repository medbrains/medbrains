import { Group, Select, Stack, Text, TextInput } from "@mantine/core";
import type { LabReferralDoctor } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { type Control, Controller, type FieldErrors, useWatch } from "react-hook-form";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { SegmentedControl } from "@/components/ui";
import { searchErrorText } from "@/lib/search-error";
import { labService } from "@/services/lab.service";
import type { LabCounterFormValues } from "./order-create.form";

interface ReferralFieldsProps {
  control: Control<LabCounterFormValues>;
  errors: FieldErrors<LabCounterFormValues>;
}

const REFERRAL_OPTIONS = [
  { value: "self", label: "Self" },
  { value: "internal", label: "Hospital doctor" },
  { value: "external", label: "Outside doctor" },
];

/** Who sent a walk-in patient: self, a hospital doctor, or an outside one. */
export function ReferralFields({ control, errors }: ReferralFieldsProps) {
  const kind = useWatch({ control, name: "referral_kind" });
  const pickedOnFile = useWatch({ control, name: "referral_doctor_id" });

  return (
    <Stack gap="xs">
      <Stack gap={4}>
        <Text size="sm" fw={500} id="referral-kind-label">
          Referred by
        </Text>
        <Controller
          control={control}
          name="referral_kind"
          render={({ field }) => (
            <SegmentedControl
              aria-labelledby="referral-kind-label"
              data={REFERRAL_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value)}
            />
          )}
        />
      </Stack>
      {kind === "internal" && (
        <Controller
          control={control}
          name="doctor_id"
          render={({ field }) => (
            <DoctorSearchSelect
              label="Referring doctor"
              value={field.value}
              onChange={field.onChange}
              error={errors.doctor_id?.message}
              required
            />
          )}
        />
      )}
      {kind === "external" && (
        <>
          <ExternalDoctorPicker control={control} />
          {!pickedOnFile && (
            <Group grow align="flex-start">
              <Controller
                control={control}
                name="external_name"
                render={({ field }) => (
                  <TextInput
                    label="Doctor's name"
                    placeholder="As on the prescription"
                    error={errors.external_name?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                control={control}
                name="external_registration_no"
                render={({ field }) => (
                  <TextInput label="Registration no." placeholder="e.g. KMC-12345" {...field} />
                )}
              />
              <Controller
                control={control}
                name="external_phone"
                render={({ field }) => <TextInput label="Phone" type="tel" {...field} />}
              />
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}

function ExternalDoctorPicker({ control }: { control: Control<LabCounterFormValues> }) {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lab-referral-doctors"],
    queryFn: () => labService.listLabReferralDoctors(),
    staleTime: 300_000,
  });
  const options = data
    .filter((d: LabReferralDoctor) => d.is_active)
    .map((d: LabReferralDoctor) => ({
      value: d.id,
      label: [d.name, d.registration_no, d.hospital_name].filter(Boolean).join(" · "),
    }));

  return (
    <Controller
      control={control}
      name="referral_doctor_id"
      render={({ field }) => (
        <Select
          label="Outside doctor on file"
          placeholder={isLoading ? "Loading…" : "Search by name or registration no."}
          description="Not on file? Leave this empty and type their details below."
          data={options}
          value={field.value || null}
          onChange={(value) => field.onChange(value ?? "")}
          error={searchErrorText(error, "referring doctors") ?? undefined}
          nothingFoundMessage="Not on file — type their details below"
          searchable
          clearable
        />
      )}
    />
  );
}
