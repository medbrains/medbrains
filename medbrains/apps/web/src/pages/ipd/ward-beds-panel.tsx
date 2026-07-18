// IPD WardBedsPanel — split from ipd.tsx (pure move).

import { bedStatusBadgeTones, protectedIpdPatientIdentifier, protectedIpdPatientName } from "./shared";
import { useProtectedFieldAccess } from "@/components";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { ipdService } from "@/services/ipd.service";
import { Group, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import type { WardBedRow } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function WardBedsPanel({ wardId, canManage }: { wardId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const [bedLocationId, setBedLocationId] = useState("");
  const [bedTypeId, setBedTypeId] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-ward-beds", wardId],
    queryFn: () => ipdService.listWardBeds(wardId),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      ipdService.assignBedToWard(wardId, {
        bed_location_id: bedLocationId,
        bed_type_id: bedTypeId || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      setBedLocationId("");
      setBedTypeId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: string) => ipdService.removeBedFromWard(wardId, mappingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
    },
  });

  const beds = (data ?? []) as WardBedRow[];

  return (
    <Stack>
      {canManage && (
        <Group>
          <TextInput
            placeholder="Bed Location ID"
            value={bedLocationId}
            onChange={(e) => setBedLocationId(e.currentTarget.value)}
          />
          <TextInput
            placeholder="Bed Type ID"
            value={bedTypeId}
            onChange={(e) => setBedTypeId(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            size="sm"
            onClick={() => assignMutation.mutate()}
            loading={assignMutation.isPending}
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
                  <Text size="sm">{b.bed_type_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={bedStatusBadgeTones[b.status] ?? "neutral"}>
                    {b.status}
                  </Badge>
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
                        disabled={b.status === "occupied"}
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
