// IPD WardBedsPanel — split from ipd.tsx (pure move).

import { Group, Select, Stack, Text, Tooltip } from "@mantine/core";
import type { WardBedRow } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProtectedFieldAccess } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { ipdService } from "@/services/ipd.service";
import {
  bedDashboardStatusLabel,
  bedStatusBadgeTones,
  protectedIpdPatientIdentifier,
  protectedIpdPatientName,
} from "./shared";

export function WardBedsPanel({ wardId, canManage }: { wardId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const { t } = useTranslation("ipd");
  const [bedLocationId, setBedLocationId] = useState<string | null>(null);
  const [bedTypeId, setBedTypeId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["ipd-ward-beds", wardId],
    queryFn: () => ipdService.listWardBeds(wardId),
  });
  const { data: bedTypes = [] } = useQuery({
    queryKey: ["setup-bed-types"],
    queryFn: () => ipdService.listBedTypes(),
    enabled: canManage,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["setup-locations"],
    queryFn: () => ipdService.listLocations(),
    enabled: canManage,
  });
  const classOptions = useMemo(
    () => bedTypes.filter((bt) => bt.is_active).map((bt) => ({ value: bt.id, label: bt.name })),
    [bedTypes],
  );

  const assignMutation = useMutation({
    mutationFn: () =>
      ipdService.assignBedToWard(wardId, {
        bed_location_id: bedLocationId ?? "",
        bed_type_id: bedTypeId ?? undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      setBedLocationId(null);
      setBedTypeId(null);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Bed not assigned" }),
  });

  const classMutation = useMutation({
    mutationFn: ({ mappingId, typeId }: { mappingId: string; typeId: string | null }) =>
      ipdService.updateWardBed(wardId, mappingId, { bed_type_id: typeId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Bed class not saved" }),
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: string) => ipdService.removeBedFromWard(wardId, mappingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
    },
  });

  const beds = (data ?? []) as WardBedRow[];
  // Beds in this ward are already placed; the picker offers the rest.
  const mapped = new Set(beds.map((b) => b.bed_location_id));
  const bedOptions = locations
    .filter((l) => l.level === "bed" && l.is_active && !mapped.has(l.id))
    .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }));

  return (
    <Stack>
      {canManage && (
        <Group>
          <Select
            label="Bed"
            placeholder="Choose a bed"
            data={bedOptions}
            value={bedLocationId}
            onChange={setBedLocationId}
            searchable
            nothingFoundMessage="No unassigned beds"
          />
          <Select
            label="Bed class"
            placeholder="Choose a class"
            data={classOptions}
            value={bedTypeId}
            onChange={setBedTypeId}
            clearable
          />
          <Button
            tone="primary"
            size="sm"
            onClick={() => assignMutation.mutate()}
            loading={assignMutation.isPending}
            disabled={!bedLocationId}
          >
            Assign Bed
          </Button>
        </Group>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Bed</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Patient</Table.Th>
            {canManage && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {beds.map((b) => {
            const patientName = protectedIpdPatientName(b.patient_name, patientNameAccess);
            const patientUhid = protectedIpdPatientIdentifier(b.patient_uhid, uhidAccess);

            return (
              <Table.Tr key={b.mapping_id}>
                <Table.Td>
                  <Text size="sm">{b.bed_name}</Text>
                </Table.Td>
                <Table.Td>
                  {canManage ? (
                    <Select
                      aria-label={`Class of bed ${b.bed_name}`}
                      placeholder="No class set"
                      data={classOptions}
                      value={b.bed_type_id}
                      onChange={(typeId) =>
                        classMutation.mutate({ mappingId: b.mapping_id, typeId })
                      }
                      clearable
                      size="xs"
                    />
                  ) : (
                    <Text size="sm">{b.bed_type_name ?? "—"}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {b.bed_status && (
                    <Badge size="xs" tone={bedStatusBadgeTones[b.bed_status] ?? "neutral"}>
                      {bedDashboardStatusLabel(t, b.bed_status)}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {b.patient_name ? (
                    <Stack gap={0}>
                      <Text size="xs">{patientName}</Text>
                      <Text size="xs" c="dimmed">
                        {patientUhid}
                      </Text>
                    </Stack>
                  ) : (
                    "—"
                  )}
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <Tooltip label="Remove from ward">
                      <IconButton
                        tone="danger"
                        aria-label="Remove from ward"
                        onClick={() =>
                          confirmDestructive({
                            title: "Remove bed",
                            message: `Remove bed ${b.bed_name} from this ward?`,
                            confirmLabel: "Remove bed",
                            onConfirm: () => removeMutation.mutate(b.mapping_id),
                          })
                        }
                        disabled={b.bed_status === "occupied"}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </Tooltip>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {beds.length === 0 && (
        <Text c="dimmed" size="sm">
          No beds assigned to this ward.
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── IP Type Configuration Section ────────────────────────
// ═══════════════════════════════════════════════════════════
