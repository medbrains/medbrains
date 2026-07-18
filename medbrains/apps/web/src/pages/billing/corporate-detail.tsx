// Billing CorporateDetail — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import type {
  BillingCorporateEnrollmentFormInput,
  BillingCorporateUpdateFormInput,
} from "@medbrains/schemas";
import {
  billingCorporateEnrollmentFormSchema,
  billingCorporateUpdateFormSchema,
} from "@medbrains/schemas";
import type {
  CorporateEnrollment,
  CreateEnrollmentRequest,
  Invoice,
  UpdateCorporateRequest,
} from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  billingOptionalInteger,
  billingOptionalNumber,
  billingOptionalText,
} from "@/forms/billing.form";
import { billingService } from "@/services/billing.service";
import { statusColors } from "./shared";

export function CorporateDetail({
  corporateId,
  canUpdate,
}: {
  corporateId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [showEnroll, setShowEnroll] = useState(false);
  const [editing, setEditing] = useState(false);
  const enrollmentDefaults: BillingCorporateEnrollmentFormInput = {
    patient_id: "",
    employee_id: "",
    department: "",
  };
  const corporateUpdateDefaults: BillingCorporateUpdateFormInput = {
    name: "",
    gst_number: "",
    billing_address: "",
    contact_email: "",
    contact_phone: "",
    credit_limit: "",
    credit_days: "",
    agreed_discount_percent: "",
    is_active: true,
  };
  const {
    control: enrollmentControl,
    register: registerEnrollment,
    reset: resetEnrollment,
    handleSubmit: handleSubmitEnrollment,
    formState: { errors: enrollmentErrors },
  } = useForm<BillingCorporateEnrollmentFormInput>({
    resolver: zodResolver(billingCorporateEnrollmentFormSchema),
    defaultValues: enrollmentDefaults,
  });
  const {
    control: updateControl,
    register: registerUpdate,
    reset: resetUpdate,
    handleSubmit: handleSubmitUpdate,
    formState: { errors: updateErrors },
  } = useForm<BillingCorporateUpdateFormInput>({
    resolver: zodResolver(billingCorporateUpdateFormSchema),
    defaultValues: corporateUpdateDefaults,
  });

  const { data: corporate } = useQuery({
    queryKey: ["corporate", corporateId],
    queryFn: () => billingService.getCorporate(corporateId),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["corporate-enrollments", corporateId],
    queryFn: () => billingService.listCorporateEnrollments(corporateId),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["corporate-invoices", corporateId],
    queryFn: () => billingService.listCorporateInvoices(corporateId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCorporateRequest) => billingService.updateCorporate(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate", corporateId] });
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      setEditing(false);
      resetUpdate(corporateUpdateDefaults);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) =>
      billingService.createCorporateEnrollment(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] });
      setShowEnroll(false);
      resetEnrollment(enrollmentDefaults);
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) =>
      billingService.deleteCorporateEnrollment(corporateId, enrollmentId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] }),
  });

  if (!corporate) return <Text c="dimmed">Loading...</Text>;

  const handleUpdateCorporate = (values: BillingCorporateUpdateFormInput) => {
    const payload: UpdateCorporateRequest = {
      name: values.name.trim(),
      gst_number: billingOptionalText(values.gst_number),
      billing_address: billingOptionalText(values.billing_address),
      contact_email: billingOptionalText(values.contact_email),
      contact_phone: billingOptionalText(values.contact_phone),
      credit_limit: billingOptionalNumber(values.credit_limit),
      credit_days: billingOptionalInteger(values.credit_days),
      agreed_discount_percent: billingOptionalNumber(values.agreed_discount_percent),
      is_active: values.is_active,
    };
    updateMutation.mutate(payload);
  };

  const handleEnrollCorporatePatient = (values: BillingCorporateEnrollmentFormInput) => {
    const payload: CreateEnrollmentRequest = {
      patient_id: values.patient_id.trim(),
      employee_id: billingOptionalText(values.employee_id),
      department: billingOptionalText(values.department),
    };
    enrollMutation.mutate(payload);
  };

  const toggleEdit = () => {
    if (editing) {
      resetUpdate(corporateUpdateDefaults);
      setEditing(false);
      return;
    }
    resetUpdate({
      name: corporate.name,
      gst_number: corporate.gst_number ?? "",
      billing_address: corporate.billing_address ?? "",
      contact_email: corporate.contact_email ?? "",
      contact_phone: corporate.contact_phone ?? "",
      credit_limit: Number(corporate.credit_limit),
      credit_days: corporate.credit_days,
      agreed_discount_percent: Number(corporate.agreed_discount_percent),
      is_active: corporate.is_active,
    });
    setEditing(true);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {corporate.name}
        </Text>
        <Badge size="lg" tone={corporate.is_active ? "success" : "danger"}>
          {corporate.is_active ? "Active" : "Inactive"}
        </Badge>
      </Group>

      <SimpleGrid cols={2}>
        <Text size="sm">
          Code: <b>{corporate.code}</b>
        </Text>
        <Text size="sm">GSTIN: {corporate.gst_number ?? "—"}</Text>
        <Text size="sm">Credit Limit: ₹{corporate.credit_limit}</Text>
        <Text size="sm">Credit Days: {corporate.credit_days}</Text>
        <Text size="sm">Discount: {corporate.agreed_discount_percent}%</Text>
        <Text size="sm">Email: {corporate.contact_email ?? "—"}</Text>
      </SimpleGrid>

      {canUpdate && (
        <>
          <Button tone="secondary" size="xs" onClick={toggleEdit}>
            {editing ? "Cancel Edit" : "Edit Client"}
          </Button>
          {editing && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitUpdate(handleUpdateCorporate)}>
              <Group grow>
                <TextInput
                  label="Name"
                  required
                  error={updateErrors.name?.message}
                  {...registerUpdate("name")}
                />
                <TextInput
                  label="GST Number"
                  error={updateErrors.gst_number?.message}
                  {...registerUpdate("gst_number")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Contact Email"
                  error={updateErrors.contact_email?.message}
                  {...registerUpdate("contact_email")}
                />
                <TextInput
                  label="Contact Phone"
                  error={updateErrors.contact_phone?.message}
                  {...registerUpdate("contact_phone")}
                />
              </Group>
              <Textarea
                label="Billing Address"
                error={updateErrors.billing_address?.message}
                {...registerUpdate("billing_address")}
              />
              <Group grow>
                <Controller
                  control={updateControl}
                  name="credit_limit"
                  render={({ field }) => (
                    <NumberInput
                      label="Credit Limit"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.credit_limit?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="credit_days"
                  render={({ field }) => (
                    <NumberInput
                      label="Credit Days"
                      min={0}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.credit_days?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="agreed_discount_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Discount %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.agreed_discount_percent?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="is_active"
                  render={({ field }) => (
                    <Switch
                      label="Active"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.currentTarget.checked)}
                    />
                  )}
                />
              </Group>
              <Button tone="primary" size="xs" type="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">
        Enrollments ({enrollments.length})
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient</Table.Th>
            <Table.Th>Employee ID</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Enrolled</Table.Th>
            {canUpdate && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {enrollments.map((e: CorporateEnrollment) => (
            <Table.Tr key={e.id}>
              <Table.Td>
                <PatientNameCell patientId={e.patient_id} showUhid={false} />
              </Table.Td>
              <Table.Td>{e.employee_id ?? "—"}</Table.Td>
              <Table.Td>{e.department ?? "—"}</Table.Td>
              <Table.Td>{new Date(e.enrolled_at).toLocaleDateString()}</Table.Td>
              {canUpdate && (
                <Table.Td>
                  <IconButton
                    tone="danger"
                    aria-label="Delete"
                    size="sm"
                    onClick={() => unenrollMutation.mutate(e.id)}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canUpdate && (
        <>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowEnroll(!showEnroll)}
          >
            Enroll Patient
          </Button>
          {showEnroll && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleSubmitEnrollment(handleEnrollCorporatePatient)}
            >
              <Group grow>
                <Controller
                  control={enrollmentControl}
                  name="patient_id"
                  render={({ field }) => (
                    <PatientSearchSelect
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      required
                      error={enrollmentErrors.patient_id?.message}
                    />
                  )}
                />
                <Controller
                  control={enrollmentControl}
                  name="employee_id"
                  render={({ field }) => (
                    <EmployeeSearchSelect
                      value={field.value}
                      onChange={(id) => field.onChange(id ?? "")}
                    />
                  )}
                />
                <TextInput
                  label="Department"
                  error={enrollmentErrors.department?.message}
                  {...registerEnrollment("department")}
                />
              </Group>
              <Button tone="primary" size="xs" type="submit" loading={enrollMutation.isPending}>
                Enroll
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">
        Corporate Invoices ({invoices.length})
      </Text>
      {invoices.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv: Invoice) => (
              <Table.Tr key={inv.id}>
                <Table.Td>{inv.invoice_number}</Table.Td>
                <Table.Td>
                  <Badge tone={statusColors[inv.status] ?? "neutral"}>
                    {inv.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>₹{inv.total_amount}</Table.Td>
                <Table.Td>{new Date(inv.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No invoices found
        </Text>
      )}
    </Stack>
  );
}

// ── Reports Tab ─────────────────────────────────────────
