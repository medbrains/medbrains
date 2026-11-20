import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, TextInput } from "@mantine/core";
import type { UpdateTenantInput } from "@medbrains/schemas";
import { updateTenantSchema } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import { type Resolver, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { HospitalLocaleFields } from "./HospitalLocaleFields";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function HospitalStep({ onNext, onBack }: Props) {
  const stored = useOnboardingStore((s) => s.hospitalDetails);
  const setHospitalDetails = useOnboardingStore((s) => s.setHospitalDetails);

  const form = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema) as Resolver<UpdateTenantInput>,
    defaultValues: {
      address_line1: stored?.address_line1 ?? "",
      address_line2: stored?.address_line2 ?? "",
      city: stored?.city ?? "",
      pincode: stored?.pincode ?? "",
      phone: stored?.phone ?? "",
      email: stored?.email ?? "",
      website: stored?.website ?? "",
      registration_no: stored?.registration_no ?? "",
      accreditation: stored?.accreditation ?? "",
      timezone: stored?.timezone ?? null,
      currency: stored?.currency ?? null,
      fy_start_month: stored?.fy_start_month ?? null,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setHospitalDetails({
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      registration_no: data.registration_no || null,
      accreditation: data.accreditation || null,
      // Empty means "the country's": the server applies its presets.
      timezone: data.timezone || null,
      currency: data.currency || null,
      fy_start_month: data.fy_start_month ?? null,
    });
    onNext();
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <div className={classes.formGrid}>
          <TextInput
            label="Address Line 1"
            placeholder="Street address"
            {...form.register("address_line1")}
            error={form.formState.errors.address_line1?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="Address Line 2"
            placeholder="Locality / landmark"
            {...form.register("address_line2")}
            error={form.formState.errors.address_line2?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="City"
            placeholder="City"
            {...form.register("city")}
            error={form.formState.errors.city?.message}
          />
          <TextInput
            label="PIN Code"
            placeholder="600001"
            {...form.register("pincode")}
            error={form.formState.errors.pincode?.message}
          />
          <TextInput
            label="Phone"
            placeholder="+91 1234567890"
            {...form.register("phone")}
            error={form.formState.errors.phone?.message}
          />
          <TextInput
            label="Email"
            placeholder="info@hospital.com"
            {...form.register("email")}
            error={form.formState.errors.email?.message}
            type="email"
          />
          <TextInput
            label="Website"
            placeholder="https://hospital.com"
            {...form.register("website")}
            error={form.formState.errors.website?.message}
            className={classes.fullWidth}
          />
          <TextInput
            label="Registration Number"
            placeholder="Hospital registration number"
            {...form.register("registration_no")}
            error={form.formState.errors.registration_no?.message}
          />
          <TextInput
            label="Accreditation"
            placeholder="e.g., NABH, JCI"
            {...form.register("accreditation")}
            error={form.formState.errors.accreditation?.message}
          />
          <HospitalLocaleFields form={form} />
        </div>

        <div className={classes.navButtons}>
          <Button tone="secondary" onClick={onBack}>
            Back
          </Button>
          <Button tone="primary" type="submit">
            Save & Continue
          </Button>
        </div>
      </Stack>
    </form>
  );
}
