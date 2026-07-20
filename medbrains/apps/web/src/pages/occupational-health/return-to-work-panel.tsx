// IPD ReturnToWorkPanel — split from occupational-health.tsx (pure move).

import { Card, Stack, Text, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { ReturnToWorkClearanceRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";

export function ReturnToWorkPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();

  const [form, setForm] = useState<ReturnToWorkClearanceRequest>({
    employee_id: "",
    clearance_date: new Date().toISOString().slice(0, 10),
  });

  const clearanceMut = useMutation({
    mutationFn: () => occupationalHealthService.returnToWorkClearance(form),
    onSuccess: () => {
      notifications.show({
        title: "Clearance Issued",
        message:
          "Return-to-work clearance issued successfully. A screening record has been created.",
        color: "success",
      });
      void qc.invalidateQueries({ queryKey: ["occ-screenings"] });
      setForm({
        employee_id: "",
        clearance_date: new Date().toISOString().slice(0, 10),
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack gap="md" maw={600}>
      <Card withBorder p="lg">
        <Text fw={600} size="lg" mb="sm">
          Issue Return-to-Work Clearance
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          This form creates a fitness clearance for an employee returning from injury or extended
          medical absence. A screening record will be automatically generated.
        </Text>
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <DateInput
            label="Clearance Date"
            required
            value={form.clearance_date ? new Date(form.clearance_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                clearance_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Textarea
            label="Restrictions"
            placeholder="e.g. No heavy lifting for 4 weeks"
            value={form.restrictions ?? ""}
            onChange={(e) => setForm({ ...form, restrictions: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Follow-up Date"
            value={form.follow_up_date ? new Date(form.follow_up_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                follow_up_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          {canCreate && (
            <Button
              tone="primary"
              onClick={() => clearanceMut.mutate()}
              loading={clearanceMut.isPending}
              disabled={!form.employee_id || !form.clearance_date}
            >
              Issue RTW Clearance
            </Button>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
