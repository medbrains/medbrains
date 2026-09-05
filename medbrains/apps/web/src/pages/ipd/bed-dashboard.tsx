// IPD BedDashboardTab — split from ipd.tsx (pure move).

import { Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import type { BedDashboardRow, BedDashboardSummary, BedReservation } from "@medbrains/types";
import {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import {
  IconArrowsExchange,
  IconBookmark,
  IconBuildingHospital,
  IconEye,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { OperationalSignal, PatientSearchSelect, useProtectedFieldAccess } from "@/components";
import { Alert, Button, Input, Modal } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { ipdAdmissionWorkspaceTabRoute } from "../ipd-workspace";
import { BedTransferModal } from "./bed-transfer-modal";
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

  // Holding a bed is its own permission, not part of managing bed status:
  // a ward clerk who may mark a bed clean is not necessarily the person who
  // may promise it to an incoming patient.
  const canReserveBeds = useHasPermission(P.IPD.RESERVATIONS.MANAGE);
  const [holdBedId, setHoldBedId] = useState<string | null>(null);
  const [holdBedName, setHoldBedName] = useState("");
  const [holdPatientId, setHoldPatientId] = useState("");
  const [holdUntil, setHoldUntil] = useState<Date | null>(null);
  const [holdPurpose, setHoldPurpose] = useState("");
  const [outOfServiceBed, setOutOfServiceBed] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [outOfServiceReason, setOutOfServiceReason] = useState("");
  const [transferFor, setTransferFor] = useState<{
    admissionId: string;
    patientId: string;
  } | null>(null);

  const closeOutOfServiceModal = () => {
    setOutOfServiceBed(null);
    setOutOfServiceReason("");
  };

  const closeHoldModal = () => {
    setHoldBedId(null);
    setHoldBedName("");
    setHoldPatientId("");
    setHoldUntil(null);
    setHoldPurpose("");
  };

  const openHoldModal = (bed: BedDashboardRow) => {
    setHoldBedId(bed.bed_location_id);
    setHoldBedName(bed.bed_name ?? "");
    setHoldPatientId("");
    // A hold with no end is a bed quietly removed from the hospital. Default
    // to the end of the day and let the clerk extend it deliberately.
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 0, 0);
    setHoldUntil(endOfDay);
    setHoldPurpose("");
  };

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
    mutationFn: ({ bedId, status, reason }: { bedId: string; status: string; reason?: string }) =>
      ipdService.updateBedStatus(bedId, { status, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
      closeOutOfServiceModal();
    },
  });

  // Taking a bed out of service asks why. A ward that finds a blocked bed with
  // no reason has to ring round to discover whether it is awaiting a deep
  // clean, has a broken frame, or is being held for an isolation case — and
  // in the meantime nobody dares use it.
  const requestStatusChange = (bed: BedDashboardRow, status: string) => {
    if (status === "blocked" || status === "maintenance") {
      setOutOfServiceBed({ id: bed.bed_location_id, name: bed.bed_name ?? "", status });
      setOutOfServiceReason("");
      return;
    }
    updateStatusMutation.mutate({ bedId: bed.bed_location_id, status });
  };

  // One request for the whole board, then a map lookup per card. The
  // per-bed endpoint exists but calling it from inside the grid would be one
  // request per bed on a screen that renders every bed in the hospital.
  const { data: reservationsData, isError: reservationsFailed } = useQuery({
    queryKey: ["ipd-bed-reservations"],
    queryFn: () => ipdService.listBedReservations(),
    enabled: canReserveBeds,
  });

  // Keyed by bed_id, which is the bed's *location* id — the same column the
  // admission gate joins on. Keying this by bed_state_id would produce holds
  // that look right on the board and that no gate would ever see.
  const heldByLocationId = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, BedReservation>();
    for (const r of (reservationsData ?? []) as BedReservation[]) {
      if (r.status !== "active" && r.status !== "confirmed") continue;
      if (new Date(r.reserved_until).getTime() <= now) continue;
      map.set(r.bed_id, r);
    }
    return map;
  }, [reservationsData]);

  const invalidateBoard = () => {
    void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
    void queryClient.invalidateQueries({ queryKey: ["ipd-bed-reservations"] });
  };

  const holdMutation = useMutation({
    mutationFn: () =>
      ipdService.createBedReservation({
        bed_id: holdBedId ?? "",
        patient_id: holdPatientId,
        reserved_from: new Date().toISOString(),
        reserved_until: (holdUntil ?? new Date()).toISOString(),
        purpose: holdPurpose || undefined,
      }),
    onSuccess: () => {
      invalidateBoard();
      closeHoldModal();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (reservationId: string) =>
      ipdService.updateBedReservationStatus(reservationId, { status: "cancelled" }),
    onSuccess: invalidateBoard,
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

      {/* If the holds cannot be read, every bed renders as free. Saying so is
          the difference between "no bed is held" and "we do not know which
          beds are held" — the second is a reason to ring the ward, not to
          assign the bed. */}
      {reservationsFailed && (
        <Alert tone="warning" title={t("bedDashboard.hold.readFailedTitle")}>
          {t("bedDashboard.hold.readFailedBody")}
        </Alert>
      )}

      {isLoading ? (
        <Text c="dimmed">{t("bedDashboard.loadingBeds")}</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
          {beds.map((bed) => {
            const bedStatus = bed.bed_status;
            const admissionId = bed.admission_id;
            // A map lookup, not a hook — hooks cannot be called in a map.
            const held = heldByLocationId.get(bed.bed_location_id);
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
                  {" · "}
                  {/* "Is a bed free" is rarely the question. "Is an ICU bed
                      free", "is a private room free" is — the class sets both
                      the tariff and whether the patient can safely go there.
                      Saying "No class set" rather than showing nothing is the
                      difference between a bed nobody has classified and a
                      general-ward bed. */}
                  {bed.bed_type_name ?? t("bedDashboard.noBedType")}
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
                  {/* Without this a held bed is indistinguishable from a free
                      one, and the clerk who holds it is the only person who
                      knows. The admission gate would refuse the assignment
                      with no warning anywhere on the board. */}
                  {held && (
                    <OperationalSignal
                      icon={IconBookmark}
                      label={t("bedDashboard.hold.signalLabel")}
                      shape="token"
                      size="xs"
                      tone="blocked"
                      value={t("bedDashboard.hold.signalValue")}
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
                {/* Moving a patient between beds is the board's most common
                    action — step-up from Emergency to ICU, out of recovery
                    after theatre, a class change the family has asked for.
                    It existed only on the admission record, which means the
                    person looking at the beds had to go and find the patient
                    first. */}
                {canManageBeds && admissionId && bed.patient_id && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    mt={6}
                    leftSection={<IconArrowsExchange size={12} />}
                    onClick={() =>
                      setTransferFor({
                        admissionId,
                        patientId: bed.patient_id ?? "",
                      })
                    }
                  >
                    {t("bedDashboard.actions.transfer")}
                  </Button>
                )}
                {bed.blocked_reason && (
                  <Text size="xs" c="dimmed" mt={4}>
                    {bed.blocked_reason}
                    {bed.status_changed_by_name
                      ? ` — ${bed.status_changed_by_name}${
                          bed.status_changed_at
                            ? `, ${new Date(bed.status_changed_at).toLocaleString()}`
                            : ""
                        }`
                      : ""}
                  </Text>
                )}
                {held && (
                  <Text size="xs" c="dimmed" mt={4}>
                    {t("bedDashboard.hold.untilLabel", {
                      until: new Date(held.reserved_until).toLocaleString(),
                    })}
                    {held.purpose ? ` — ${held.purpose}` : ""}
                  </Text>
                )}
                {canReserveBeds &&
                  (held ? (
                    <Button
                      tone="ghost"
                      size="compact-xs"
                      mt={6}
                      loading={releaseMutation.isPending}
                      onClick={() => releaseMutation.mutate(held.id)}
                    >
                      {t("bedDashboard.hold.release")}
                    </Button>
                  ) : (
                    bedStatus === "vacant_clean" &&
                    !admissionId && (
                      <Button
                        tone="secondary"
                        size="compact-xs"
                        mt={6}
                        leftSection={<IconBookmark size={12} />}
                        onClick={() => openHoldModal(bed)}
                      >
                        {t("bedDashboard.hold.action")}
                      </Button>
                    )
                  ))}
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
                      if (value) requestStatusChange(bed, value);
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

      {transferFor && (
        <BedTransferModal
          admissionId={transferFor.admissionId}
          patientId={transferFor.patientId}
          opened
          onClose={() => setTransferFor(null)}
        />
      )}

      <Modal
        opened={outOfServiceBed !== null}
        onClose={closeOutOfServiceModal}
        title={t("bedDashboard.outOfService.title", { bed: outOfServiceBed?.name ?? "" })}
      >
        <Stack gap="sm">
          <Input
            label={t("bedDashboard.outOfService.reasonLabel")}
            placeholder={t("bedDashboard.outOfService.reasonPlaceholder")}
            value={outOfServiceReason}
            onChange={(e) => setOutOfServiceReason(e.currentTarget.value)}
            required
          />
          {updateStatusMutation.isError && (
            <Alert tone="danger" title={t("bedDashboard.outOfService.failedTitle")}>
              {(updateStatusMutation.error as Error).message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeOutOfServiceModal}>
              {t("bedDashboard.hold.cancel")}
            </Button>
            <Button
              tone="primary"
              loading={updateStatusMutation.isPending}
              disabled={!outOfServiceReason.trim()}
              onClick={() =>
                outOfServiceBed &&
                updateStatusMutation.mutate({
                  bedId: outOfServiceBed.id,
                  status: outOfServiceBed.status,
                  reason: outOfServiceReason.trim(),
                })
              }
            >
              {t("bedDashboard.outOfService.confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={holdBedId !== null}
        onClose={closeHoldModal}
        title={t("bedDashboard.hold.title", { bed: holdBedName })}
      >
        <Stack gap="sm">
          <PatientSearchSelect
            value={holdPatientId}
            onChange={setHoldPatientId}
            label={t("bedDashboard.hold.patientLabel")}
            required
          />
          <DateTimePicker
            label={t("bedDashboard.hold.untilFieldLabel")}
            value={holdUntil}
            onChange={(v) => setHoldUntil(v ? new Date(v) : null)}
            required
          />
          <Input
            label={t("bedDashboard.hold.purposeLabel")}
            placeholder={t("bedDashboard.hold.purposePlaceholder")}
            value={holdPurpose}
            onChange={(e) => setHoldPurpose(e.currentTarget.value)}
          />
          {holdMutation.isError && (
            <Alert tone="danger" title={t("bedDashboard.hold.failedTitle")}>
              {(holdMutation.error as Error).message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeHoldModal}>
              {t("bedDashboard.hold.cancel")}
            </Button>
            <Button
              tone="primary"
              loading={holdMutation.isPending}
              disabled={!holdPatientId || !holdUntil}
              onClick={() => holdMutation.mutate()}
            >
              {t("bedDashboard.hold.confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Reports Tab ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
