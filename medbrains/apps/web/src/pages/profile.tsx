import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { Employee, UpdateMyProfileRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, Input, Select } from "@/components/ui";

const GENDERS = ["male", "female", "other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const schema = z.object({
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  blood_group: z.string().optional(),
  address_line1: z.string().optional(),
  address_city: z.string().optional(),
  address_pincode: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_relationship: z.string().optional(),
  emergency_phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function employeeToForm(e: Employee | null): FormValues {
  const address = asObj(e?.address);
  const emergency = asObj(e?.emergency_contact);
  return {
    phone: e?.phone ?? "",
    email: e?.email ?? "",
    date_of_birth: e?.date_of_birth ?? "",
    gender: e?.gender ?? "",
    blood_group: e?.blood_group ?? "",
    address_line1: str(address.line1),
    address_city: str(address.city),
    address_pincode: str(address.pincode),
    emergency_name: str(emergency.name),
    emergency_relationship: str(emergency.relationship),
    emergency_phone: str(emergency.phone),
  };
}

function formToPayload(v: FormValues): UpdateMyProfileRequest {
  return {
    phone: v.phone,
    email: v.email || undefined,
    date_of_birth: v.date_of_birth || undefined,
    gender: v.gender || undefined,
    blood_group: v.blood_group || undefined,
    address: { line1: v.address_line1, city: v.address_city, pincode: v.address_pincode },
    emergency_contact: {
      name: v.emergency_name,
      relationship: v.emergency_relationship,
      phone: v.emergency_phone,
    },
  };
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
        {label}
      </Text>
      <Text size="sm">{value || "—"}</Text>
    </Stack>
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api.getMyProfile(),
  });
  const employee = data?.employee ?? null;
  const completeness = data?.completeness;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: employeeToForm(employee),
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => api.updateMyProfile(formToPayload(v)),
    onSuccess: () => {
      notifications.show({
        title: "Profile updated",
        message: "Your details were saved.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Save failed", message: e.message, color: "danger" }),
  });

  return (
    <Stack>
      <PageHeader
        title="My Profile"
        subtitle="Your personal details. HR manages employment, payroll and statutory fields."
      />

      {completeness && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Profile completeness</Text>
            <Text fw={700}>{completeness.percent}%</Text>
          </Group>
          <Progress
            value={completeness.percent}
            size="lg"
            radius={0}
            aria-label="Profile completeness"
          />
          {completeness.missing.length > 0 && (
            <Group gap="xs" mt="sm">
              <Text size="sm" c="dimmed">
                Still missing:
              </Text>
              {completeness.missing.map((m) => (
                <Badge key={m} tone="warning" size="sm">
                  {m.replace(/_/g, " ")}
                </Badge>
              ))}
            </Group>
          )}
        </Card>
      )}

      {!employee && !isLoading && (
        <Alert tone="info" title="No employee record">
          Your account isn't linked to an employee record yet. Contact HR to set one up.
        </Alert>
      )}

      {employee && (
        <>
          <Card withBorder padding="lg">
            <Text fw={600} mb="sm">
              Employment — HR-managed
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <ReadField label="Employee code" value={employee.employee_code} />
              <ReadField
                label="Name"
                value={`${employee.first_name} ${employee.last_name ?? ""}`.trim()}
              />
              <ReadField label="Status" value={employee.status} />
              <ReadField label="Employment type" value={employee.employment_type} />
              <ReadField label="Date of joining" value={employee.date_of_joining} />
            </SimpleGrid>
          </Card>

          <Card withBorder padding="lg">
            <Text fw={600} mb="sm">
              Personal details
            </Text>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => <Input {...field} label="Phone" />}
                  />
                  <Controller
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <Input {...field} label="Email" error={fieldState.error?.message} />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="date_of_birth"
                    render={({ field }) => <Input {...field} type="date" label="Date of birth" />}
                  />
                  <Controller
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <Select {...field} label="Gender" data={GENDERS} clearable />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="blood_group"
                    render={({ field }) => (
                      <Select {...field} label="Blood group" data={BLOOD_GROUPS} clearable />
                    )}
                  />
                </SimpleGrid>

                <Text fw={600} size="sm" mt="xs">
                  Address
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Controller
                    control={form.control}
                    name="address_line1"
                    render={({ field }) => <Input {...field} label="Address line" />}
                  />
                  <Controller
                    control={form.control}
                    name="address_city"
                    render={({ field }) => <Input {...field} label="City" />}
                  />
                  <Controller
                    control={form.control}
                    name="address_pincode"
                    render={({ field }) => <Input {...field} label="PIN code" />}
                  />
                </SimpleGrid>

                <Text fw={600} size="sm" mt="xs">
                  Emergency contact
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Controller
                    control={form.control}
                    name="emergency_name"
                    render={({ field }) => <Input {...field} label="Name" />}
                  />
                  <Controller
                    control={form.control}
                    name="emergency_relationship"
                    render={({ field }) => <Input {...field} label="Relationship" />}
                  />
                  <Controller
                    control={form.control}
                    name="emergency_phone"
                    render={({ field }) => <Input {...field} label="Phone" />}
                  />
                </SimpleGrid>

                <Group justify="flex-end">
                  <Button type="submit" tone="primary" loading={save.isPending}>
                    Save changes
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </>
      )}
    </Stack>
  );
}
