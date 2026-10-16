/**
 * Step 2 of a trial: the hospital's name and code, and the person who will
 * run it. Submitting creates the hospital, starts the 30-day trial and signs
 * them in.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack } from "@mantine/core";
import { onboardingInitSchema } from "@medbrains/schemas";
import { useAuthStore } from "@medbrains/stores";
import { applyServerErrors } from "@medbrains/utils";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import type { z } from "zod";
import { Button, Input, PasswordField } from "@/components/ui";
import { rememberHospitalCode } from "@/lib/hospital-code";
import { onboardingService } from "@/services/onboarding.service";
import type { FacilityChoice } from "./facility-step";

const schema = onboardingInitSchema.omit({ hospital_type: true });
type AccountValues = z.infer<typeof schema>;

const FIELDS: Array<{ name: keyof AccountValues; label: string; description?: string }> = [
  { name: "hospital_name", label: "Hospital name" },
  {
    name: "hospital_code",
    label: "Hospital code",
    description: "Your staff type this to sign in, e.g. CITYCARE",
  },
  { name: "admin_full_name", label: "Your full name" },
  { name: "admin_email", label: "Work email" },
  { name: "admin_username", label: "Username" },
];

/** "City Care Hospital" → "CITYCARE": a code staff can type. */
function suggestCode(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const stem = words.filter((w) => !["HOSPITAL", "CLINIC", "THE", "AND"].includes(w));
  return (stem.length ? stem : words).join("").slice(0, 12);
}

interface AccountStepProps {
  facility: FacilityChoice;
  onBack: () => void;
}

export function AccountStep({ facility, onBack }: AccountStepProps) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const form = useForm<AccountValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hospital_name: "",
      hospital_code: "",
      admin_full_name: "",
      admin_email: "",
      admin_username: "",
      admin_password: "",
    },
  });
  const start = useMutation({
    mutationFn: (values: AccountValues) =>
      onboardingService.onboardingInit({
        ...values,
        hospital_type: facility.hospitalType,
        plan: facility.plan,
      }),
    onSuccess: (data, values) => {
      onboardingService.setCsrfToken(data.csrf_token);
      rememberHospitalCode(values.hospital_code);
      const now = new Date().toISOString();
      setAuth({
        id: data.user_id,
        tenant_id: data.tenant_id,
        username: values.admin_username,
        email: values.admin_email,
        full_name: values.admin_full_name,
        role: data.role,
        access_matrix: {},
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => applyServerErrors(error, form.setError),
  });

  return (
    <Stack
      component="form"
      gap="md"
      aria-label="Your hospital"
      onSubmit={form.handleSubmit((values) => start.mutate(values))}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {FIELDS.map(({ name, label, description }) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label={label}
                description={description}
                withAsterisk
                error={fieldState.error?.message}
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  field.onChange(name === "hospital_code" ? next.toUpperCase() : next);
                  if (name === "hospital_name" && !form.getFieldState("hospital_code").isDirty) {
                    form.setValue("hospital_code", suggestCode(next));
                  }
                }}
              />
            )}
          />
        ))}
        <Controller
          control={form.control}
          name="admin_password"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Password"
              description="8+ characters with upper and lower case, a digit and a symbol"
              withAsterisk
              error={fieldState.error?.message}
            />
          )}
        />
      </SimpleGrid>
      <Group justify="space-between">
        <Button tone="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" tone="primary" loading={start.isPending}>
          Start my free trial
        </Button>
      </Group>
    </Stack>
  );
}
