// IPD BedDashboardTab — split from ipd.tsx (pure move).

import { Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { BedDashboardRow, BedDashboardSummary } from "@medbrains/types";
import {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import { IconBuildingHospital, IconEye } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { OperationalSignal, useProtectedFieldAccess } from "@/components";
import { Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { ipdAdmissionWorkspaceTabRoute } from "../ipd-workspace";
import { BedTurnaroundView } from "./bed-turnaround";
import {
  bedDashboardSignalLabel,
  bedDashboardStatusIcon,
  bedDashboardStatusLabel,
  bedDashboardStatusShape,
  bedDashboardStatusTone,
  bedStatusColors,
  protectedIpdPatientIdentifier,
  protectedIpdPatientName,
} from "./shared";

export function BedDashboardTab() {
  const { t } = useTranslation("ipd");
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const canViewAdmissions = useHasPermission(P.IPD.ADMISSIONS_VIEW);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterWard, setFilterWard] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showTurnaround, setShowTurnaround] = useState(false);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);

  const { data: summaryData } = useQuery({
    queryKey: ["ipd-bed-dashboard-summary"],
    queryFn: () => ipdService.bedDashboardSummary(),
  });

  const bedParams: Record<string, string> = {};
  if (filterWard) bedParams.ward_id = filterWard;
  if (filterStatus) bedParams.status = filterStatus;

  const { data: bedsData, isLoading } = useQuery({
    queryKey: ["ipd-bed-dashboard-beds", bedParams],
    queryFn: () =>
      ipdService.bedDashboardBeds(Object.keys(bedParams).length > 0 ? bedParams : undefined),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      ipdService.updateBedStatus(bedId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
    },
  });

  const summaryRows = (summaryData ?? []) as BedDashboardSummary[];
  const beds = (bedsData ?? []) as BedDashboardRow[];

  // Aggregate totals across all wards
  const totals = summaryRows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      vacant_clean: acc.vacant_clean + r.vacant_clean,
      vacant_dirty: acc.vacant_dirty + r.vacant_dirty,
      occupied: acc.occupied + r.occupied,
      reserved: acc.reserved + r.reserved,
      maintenance: acc.maintenance + r.maintenance,
      blocked: acc.blocked + r.blocked,
    }),
    {
      total: 0,
      vacant_clean: 0,
      vacant_dirty: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      blocked: 0,
    },
  );

  const wardOptions = summaryRows.flatMap((row) =>
    row.ward_id
      ? [{ value: row.ward_id, label: row.ward_name ?? t("bedDashboard.unknownWard") }]
      : [],
  );
  const statusOptions = BED_BOARD_STATUS_VALUES.map((status) => ({
    value: status,
    label: bedDashboardStatusLabel(t, status),
  }));

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }}>
        <Card withBorder p="xs">
          <OperationalSignal
            label={t("bedDashboard.summary.total")}
            shape="pill"
            size="xs"
            tone="neutral"
            value={totals.total}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("vacant_clean")}
            label={bedDashboardSignalLabel(t, "vacant_clean")}
            shape={bedDashboardStatusShape("vacant_clean")}
            size="xs"
            tone={bedDashboardStatusTone("vacant_clean")}
            value={totals.vacant_clean}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("vacant_dirty")}
            label={bedDashboardSignalLabel(t, "vacant_dirty")}
            shape={bedDashboardStatusShape("vacant_dirty")}
            size="xs"
            tone={bedDashboardStatusTone("vacant_dirty")}
            value={totals.vacant_dirty}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("occupied")}
            label={bedDashboardSignalLabel(t, "occupied")}
            shape={bedDashboardStatusShape("occupied")}
            size="xs"
            tone={bedDashboardStatusTone("occupied")}
            value={totals.occupied}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("reserved")}
            label={bedDashboardSignalLabel(t, "reserved")}
            shape={bedDashboardStatusShape("reserved")}
            size="xs"
            tone={bedDashboardStatusTone("reserved")}
            value={totals.reserved}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("maintenance")}
            label={bedDashboardSignalLabel(t, "maintenance")}
            shape={bedDashboardStatusShape("maintenance")}
            size="xs"
            tone={bedDashboardStatusTone("maintenance")}
            value={totals.maintenance}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("blocked")}
            label={bedDashboardSignalLabel(t, "blocked")}
            shape={bedDashboardStatusShape("blocked")}
            size="xs"
            tone={bedDashboardStatusTone("blocked")}
            value={totals.blocked}
          />
        </Card>
      </SimpleGrid>

      <Group>
        <Select
          placeholder={t("placeholder.filterByWard")}
          data={wardOptions}
          value={filterWard}
          onChange={setFilterWard}
          clearable
          w={200}
        />
        <Select
          placeholder={t("placeholder.filterByStatus")}
          data={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={200}
        />
        <Button
          tone={showTurnaround ? "primary" : "secondary"}
          size="sm"
          onClick={() => setShowTurnaround((v) => !v)}
        >
          {t("bedDashboard.actions.turnaround")}
        </Button>
      </Group>

      {showTurnaround && <BedTurnaroundView />}

      {isLoading ? (
        <Text c="dimmed">{t("bedDashboard.loadingBeds")}</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
          {beds.map((bed) => {
            const bedStatus = bed.bed_status;
            const admissionId = bed.admission_id;
            const patientName = protectedIpdPatientName(bed.patient_name, patientNameAccess);
            const patientUhid = protectedIpdPatientIdentifier(bed.patient_uhid, uhidAccess);

            return (
              <Card
                key={bed.bed_state_id}
                withBorder
                p="xs"
                style={{
                  borderLeft: `4px solid var(--mantine-color-${bedStatusColors[bedStatus] ?? "slate"}-5)`,
                }}
              >
                <Text size="sm" fw={600}>
                  {bed.bed_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {bed.ward_name ?? t("bedDashboard.unassignedWard")}
                </Text>
                <Group gap={4} mt={6} wrap="wrap">
                  <OperationalSignal
                    icon={bedDashboardStatusIcon(bedStatus)}
                    label={bedDashboardSignalLabel(t, bedStatus)}
                    shape={bedDashboardStatusShape(bedStatus)}
                    size="xs"
                    tone={bedDashboardStatusTone(bedStatus)}
                    value={bedDashboardStatusLabel(t, bedStatus)}
                  />
                  {admissionId && (
                    <OperationalSignal
                      icon={IconBuildingHospital}
                      label={t("bedDashboard.patient.activeAdmission")}
                      shape="token"
                      size="xs"
                      tone="active"
                    />
                  )}
                </Group>
                {admissionId ? (
                  <Stack gap={0} mt={4}>
                    <Text size="xs">{patientName}</Text>
                    <Text size="xs" c="dimmed">
                      {patientUhid}
                    </Text>
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed" mt={4}>
                    {t("bedDashboard.patient.noActiveAdmission")}
                  </Text>
                )}
                {canViewAdmissions && admissionId && (
                  <Button
                    tone="ghost"
                    size="compact-xs"
                    mt={6}
                    leftSection={<IconEye size={12} />}
                    onClick={() => navigate(ipdAdmissionWorkspaceTabRoute(admissionId, "overview"))}
                  >
                    {t("bedDashboard.actions.openAdmission")}
                  </Button>
                )}
                {canManageBeds && bedStatus !== "occupied" && (
                  <Select
                    size="xs"
                    mt={4}
                    placeholder={t("placeholder.changeStatus")}
                    data={BED_BOARD_MUTABLE_STATUS_VALUES.filter(
                      (statusOption) => statusOption !== bedStatus,
                    ).map((statusOption) => ({
                      value: statusOption,
                      label: bedDashboardStatusLabel(t, statusOption),
                    }))}
                    onChange={(value) => {
                      if (value) {
                        updateStatusMutation.mutate({
                          bedId: bed.bed_location_id,
                          status: value,
                        });
                      }
                    }}
                    clearable
                  />
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      {beds.length === 0 && !isLoading && (
        <Text c="dimmed" size="sm">
          {t("bedDashboard.noBedsFound")}
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Reports Tab ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
