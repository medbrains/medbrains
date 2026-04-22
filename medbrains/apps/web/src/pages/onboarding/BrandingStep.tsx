import { Button, ColorInput, Stack, Text, TextInput } from "@mantine/core";
import { brandingSchema } from "@medbrains/schemas";
import type { BrandingInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function BrandingStep({ onNext, onBack }: Props) {
  const stored = useOnboardingStore((s) => s.branding);
  const setBranding = useOnboardingStore((s) => s.setBranding);

  const form = useForm<BrandingInput>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primary_color: stored?.primary_color ?? "#1F4332",
      secondary_color: stored?.secondary_color ?? "#B8924A",
      logo_url: stored?.logo_url ?? "",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setBranding({
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      logo_url: data.logo_url || undefined,
    });
    onNext();
  });

  const primaryColor = form.watch("primary_color");
  const secondaryColor = form.watch("secondary_color");

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Customize your hospital&apos;s branding. These colors will be used
          throughout the interface. You can change these later.
        </Text>

        <div className={classes.formGrid}>
          <Controller
            control={form.control}
            name="primary_color"
            render={({ field }) => (
              <ColorInput
                label="Primary Color"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.primary_color?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="secondary_color"
            render={({ field }) => (
              <ColorInput
                label="Secondary Color"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.secondary_color?.message}
              />
            )}
          />
        </div>

        <TextInput
          label="Logo URL"
          placeholder="https://example.com/logo.png"
          description="Optional — enter a URL for your hospital logo"
          {...form.register("logo_url")}
          error={form.formState.errors.logo_url?.message}
        />

        <div className={classes.brandingPreview}>
          <div
            className={classes.colorSwatch}
            style={{ background: primaryColor }}
          />
          <div
            className={classes.colorSwatch}
            style={{ background: secondaryColor }}
          />
          <Text size="sm" c="dimmed">
            Preview of your brand colors
          </Text>
        </div>

        <div className={classes.navButtons}>
          <Button variant="default" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">
            Save & Continue
          </Button>
        </div>
      </Stack>
    </form>
  );
}
