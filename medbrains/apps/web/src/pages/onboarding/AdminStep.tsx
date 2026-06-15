import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Divider, Progress, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import type { OnboardingInitInput } from "@medbrains/schemas";
import { onboardingInitSchema } from "@medbrains/schemas";
import { useAuthStore, useOnboardingStore } from "@medbrains/stores";
import type { HospitalType } from "@medbrains/types";
import { applyServerErrors } from "@medbrains/utils";
import { IconBuildingHospital, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { onboardingService } from "@/services/onboarding.service";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
  draftRef: MutableRefObject<Partial<OnboardingInitInput>>;
}

const hospitalTypes: { value: HospitalType; label: string }[] = [
  { value: "medical_college", label: "Medical College & Hospital" },
  { value: "multi_specialty", label: "Multi-Specialty Hospital" },
  { value: "district_hospital", label: "District Hospital" },
  { value: "community_health", label: "Community Health Center" },
  { value: "primary_health", label: "Primary Health Center" },
  { value: "standalone_clinic", label: "Standalone Clinic" },
  { value: "eye_hospital", label: "Eye Hospital" },
  { value: "dental_college", label: "Dental College" },
];

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 20;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  return Math.min(100, score);
}

export function AdminStep({ onNext, onBack, draftRef }: Props) {
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const user = useAuthStore((s) => s.user);

  const form = useForm<OnboardingInitInput>({
    resolver: zodResolver(onboardingInitSchema),
    defaultValues: {
      hospital_name: "",
      hospital_code: "",
      hospital_type: "medical_college",
      admin_full_name: "",
      admin_username: "",
      admin_email: "",
      admin_password: "",
      ...draftRef.current,
    },
  });

  // Sync form values back to the parent ref so they survive unmount
  useEffect(() => {
    const sub = form.watch((values) => {
      draftRef.current = {
        hospital_name: values.hospital_name,
        hospital_code: values.hospital_code,
        hospital_type: values.hospital_type,
        admin_full_name: values.admin_full_name,
        admin_username: values.admin_username,
        admin_email: values.admin_email,
        admin_password: values.admin_password,
      };
    });
    return () => sub.unsubscribe();
  }, [form, draftRef]);

  const setAuth = useAuthStore((s) => s.setAuth);
  const setSequences = useOnboardingStore((s) => s.setSequences);

  const initMutation = useMutation({
    mutationFn: (data: OnboardingInitInput) => onboardingService.onboardingInit(data),
    onSuccess: (data) => {
      const values = form.getValues();
      onboardingService.setCsrfToken(data.csrf_token);
      setAuth({
        id: data.user_id,
        tenant_id: data.tenant_id,
        username: values.admin_username,
        email: values.admin_email,
        full_name: values.admin_full_name,
        role: "super_admin",
        access_matrix: {},
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      // Initialize store defaults based on hospital code
      setSequences({
        uhid_prefix: `${values.hospital_code}-`,
        uhid_pad_width: 5,
        invoice_prefix: "INV-",
        invoice_pad_width: 6,
      });
      onNext();
    },
    onError: (error) => {
      applyServerErrors(error, form.setError);
    },
  });

  const password = form.watch("admin_password");
  const strength = getPasswordStrength(password);
  const strengthColor = strength < 40 ? "danger" : strength < 70 ? "warning" : "success";

  // If already authenticated (init was successful), just navigate forward
  const handleSubmit = form.handleSubmit((data) => {
    if (user) {
      onNext();
    } else {
      initMutation.mutate(data);
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        {/* ── Section 1: Hospital Information ─────────────── */}
        <div>
          <Title order={5} mb={4}>
            <IconBuildingHospital size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Hospital Information
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Enter your hospital&apos;s identity. This cannot be changed later without admin
            intervention.
          </Text>
          <div className={classes.formGrid}>
            <TextInput
              label="Hospital Name"
              placeholder="Alagappa Medical College & Hospital"
              withAsterisk
              {...form.register("hospital_name", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!codeManuallyEdited) {
                    const code = e.currentTarget.value
                      .split(/\s+/)
                      .filter((w: string) => w.length > 1 && !/^(and|the|of|for|&)$/i.test(w))
                      .map((w: string) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 6);
                    form.setValue("hospital_code", code);
                  }
                },
              })}
              error={form.formState.errors.hospital_name?.message}
              className={classes.fullWidth}
            />
            <TextInput
              label="Hospital Code"
              placeholder="ACMS"
              withAsterisk
              description="Auto-generated from name, or type your own"
              {...form.register("hospital_code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  form.setValue("hospital_code", e.currentTarget.value.toUpperCase());
                  setCodeManuallyEdited(true);
                },
              })}
              error={form.formState.errors.hospital_code?.message}
            />
            <Controller
              control={form.control}
              name="hospital_type"
              render={({ field }) => (
                <Select
                  label="Hospital Type"
                  withAsterisk
                  data={hospitalTypes}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "medical_college")}
                  error={form.formState.errors.hospital_type?.message}
                />
              )}
            />
          </div>
        </div>

        <Divider label="Super Admin Credentials" labelPosition="center" my="xs" />

        {/* ── Section 2: Admin Credentials ────────────────── */}
        <div>
          <Title order={5} mb={4}>
            <IconLock size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Super Admin Account
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            This account will have full access to the system. Keep these credentials safe — this is
            how we identify who set up the hospital.
          </Text>
          <div className={classes.formGrid}>
            <TextInput
              label="Full Name"
              placeholder="Dr. Ramesh Kumar"
              withAsterisk
              leftSection={<IconUser size={16} />}
              {...form.register("admin_full_name")}
              error={form.formState.errors.admin_full_name?.message}
            />
            <TextInput
              label="Username"
              placeholder="ramesh.kumar"
              withAsterisk
              leftSection={<IconUser size={16} />}
              description="Lowercase letters, digits, and underscores only"
              {...form.register("admin_username")}
              error={form.formState.errors.admin_username?.message}
            />
            <TextInput
              label="Email"
              placeholder="admin@hospital.com"
              withAsterisk
              leftSection={<IconMail size={16} />}
              {...form.register("admin_email")}
              error={form.formState.errors.admin_email?.message}
              type="email"
            />
            <div>
              <TextInput
                label="Password"
                placeholder="Minimum 8 characters"
                withAsterisk
                leftSection={<IconLock size={16} />}
                type="password"
                {...form.register("admin_password")}
                error={form.formState.errors.admin_password?.message}
              />
              {password.length > 0 && (
                <Progress value={strength} color={strengthColor} size="xs" mt={4} />
              )}
            </div>
          </div>
        </div>

        {initMutation.isError && !Object.keys(form.formState.errors).length && (
          <Alert color="danger" variant="light">
            {initMutation.error.message}
          </Alert>
        )}

        <div className={classes.navButtons}>
          <Button tone="secondary" onClick={onBack}>
            Back
          </Button>
          <Button tone="primary" type="submit" loading={initMutation.isPending}>
            {user ? "Continue" : "Create Hospital & Admin"}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
