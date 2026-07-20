// IPD VaccinationsPanel — split from occupational-health.tsx (pure move).

import {
  Card,
  Drawer,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateVaccinationRequest,
  OccHealthVaccination,
  VaccinationComplianceRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";

export function VaccinationsPanel() {
  const canManage = useHasPermission(P.OCC_HEALTH.VACCINATIONS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: vaccinations = [], isLoading } = useQuery({
    queryKey: ["occ-vaccinations"],
    queryFn: () => occupationalHealthService.listVaccinations(),
  });

  const { data: compliance = [] } = useQuery<VaccinationComplianceRow[]>({
    queryKey: ["occ-vaccination-compliance"],
    queryFn: () => occupationalHealthService.vaccinationCompliance(),
  });

  const [form, setForm] = useState<CreateVaccinationRequest>({
    employee_id: "",
    vaccine_name: "",
    administered_date: "",
  });
  const [formCompliant, setFormCompliant] = useState(true);

  const createMut = useMutation({
    mutationFn: () =>
      occupationalHealthService.createVaccination({
        ...form,
        is_compliant: formCompliant,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-vaccinations"] });
      void qc.invalidateQueries({ queryKey: ["occ-vaccination-compliance"] });
      createHandlers.close();
      setForm({ employee_id: "", vaccine_name: "", administered_date: "" });
      setFormCompliant(true);
      notifications.show({
        title: "Vaccination Recorded",
        message: "Vaccination record created successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthVaccination>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "vaccine_name",
      label: "Vaccine",
      render: (r) => r.vaccine_name,
    },
    {
      key: "dose_number",
      label: "Dose #",
      render: (r) => r.dose_number.toString(),
    },
    {
      key: "administered_date",
      label: "Administered",
      render: (r) => r.administered_date,
    },
    {
      key: "is_compliant",
      label: "Compliant",
      render: (r) => (
        <Badge tone={r.is_compliant ? "success" : "danger"} variant="filled" size="sm">
          {r.is_compliant ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "next_due_date",
      label: "Next Due",
      render: (r) => r.next_due_date ?? "---",
    },
    {
      key: "batch_number",
      label: "Batch",
      render: (r) => r.batch_number ?? "---",
    },
  ];

  return (
    <>
      {/* Compliance Summary Cards */}
      {compliance.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
          {compliance.map((row) => (
            <Card key={row.vaccine_name} shadow="xs" padding="md" withBorder>
              <Text fw={600} size="sm" mb={4}>
                {row.vaccine_name}
              </Text>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {row.compliant_count} / {row.total_employees}
                </Text>
                <Badge
                  tone={
                    row.compliance_pct >= 90
                      ? "success"
                      : row.compliance_pct >= 70
                        ? "warning"
                        : "danger"
                  }
                  size="sm"
                >
                  {row.compliance_pct.toFixed(1)}%
                </Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Record Vaccination
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={vaccinations} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Record Vaccination"
        position="right"
        size="md"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <TextInput
            label="Vaccine Name"
            required
            value={form.vaccine_name}
            onChange={(e) => setForm({ ...form, vaccine_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Dose Number"
            min={1}
            value={form.dose_number ?? 1}
            onChange={(v) =>
              setForm({ ...form, dose_number: typeof v === "number" ? v : undefined })
            }
          />
          <DateInput
            label="Administered Date"
            required
            value={form.administered_date ? new Date(form.administered_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                administered_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <TextInput
            label="Batch Number"
            value={form.batch_number ?? ""}
            onChange={(e) => setForm({ ...form, batch_number: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Next Due Date"
            value={form.next_due_date ? new Date(form.next_due_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                next_due_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Switch
            label="Is Compliant"
            checked={formCompliant}
            onChange={(e) => setFormCompliant(e.currentTarget.checked)}
          />
          <TextInput
            label="Exemption Type"
            value={form.exemption_type ?? ""}
            onChange={(e) =>
              setForm({ ...form, exemption_type: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Exemption Reason"
            value={form.exemption_reason ?? ""}
            onChange={(e) =>
              setForm({ ...form, exemption_reason: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.vaccine_name || !form.administered_date}
          >
            Save Vaccination
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Injuries & Return-to-Work
// ══════════════════════════════════════════════════════════
