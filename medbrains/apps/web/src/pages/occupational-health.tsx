import "@mantine/charts/styles.css";
import { Card, Stack, Tabs, Text, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { ReturnToWorkClearanceRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBiohazard,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconReportMedical,
  IconShieldCheck,
  IconVaccine,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ExposuresPanel } from "@/pages/occupational-health/ExposuresPanel";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { OccHealthAnalyticsPanel } from "./occupational-health/analytics-panel";
import { DrugScreensPanel } from "./occupational-health/drug-screens-panel";
import { HazardRegistryPanel } from "./occupational-health/hazard-registry-panel";
import { InjuriesPanel } from "./occupational-health/injuries-panel";
import { ScreeningsPanel } from "./occupational-health/screenings-panel";
import { VaccinationsPanel } from "./occupational-health/vaccinations-panel";

// ── Constants ──────────────────────────────────────────

// ── Main Page ──────────────────────────────────────────

export function OccupationalHealthPage() {
  useRequirePermission(P.OCC_HEALTH.SCREENINGS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("screenings");

  return (
    <div>
      <PageHeader
        title="Occupational Health"
        subtitle="Employee health screenings, vaccinations, and injury tracking"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="screenings" leftSection={<IconShieldCheck size={16} />}>
            Health Screenings
          </Tabs.Tab>
          <Tabs.Tab value="drug-screens" leftSection={<IconReportMedical size={16} />}>
            Drug Screening
          </Tabs.Tab>
          <Tabs.Tab value="vaccinations" leftSection={<IconVaccine size={16} />}>
            Vaccinations
          </Tabs.Tab>
          <Tabs.Tab value="injuries" leftSection={<IconAlertTriangle size={16} />}>
            Injuries & RTW
          </Tabs.Tab>
          <Tabs.Tab value="exposures" leftSection={<IconBiohazard size={16} />}>
            Sharps & Exposures
          </Tabs.Tab>
          <Tabs.Tab value="hazards" leftSection={<IconChecklist size={16} />}>
            Hazard Registry
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
          <Tabs.Tab value="rtw-clearance" leftSection={<IconCertificate size={16} />}>
            RTW Clearance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="drug-screens" pt="md">
          <DrugScreensPanel />
        </Tabs.Panel>
        <Tabs.Panel value="vaccinations" pt="md">
          <VaccinationsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="injuries" pt="md">
          <InjuriesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="exposures" pt="md">
          <ExposuresPanel />
        </Tabs.Panel>
        <Tabs.Panel value="hazards" pt="md">
          <HazardRegistryPanel />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <OccHealthAnalyticsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="rtw-clearance" pt="md">
          <ReturnToWorkPanel />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Health Screenings
// ══════════════════════════════════════════════════════════

function ReturnToWorkPanel() {
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
