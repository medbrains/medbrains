/**
 * The bed a bedside monitor watches: its readings go to whoever is admitted
 * there. Without a bed, a monitor's readings are held, not guessed onto a
 * patient.
 */
import type { DeviceInstance } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Select, toast } from "@/components/ui";
import { adminDevicesService } from "@/services/adminDevices.service";
import { settingsSetupService } from "@/services/settingsSetup.service";

interface DeviceBedSelectProps {
  device: Pick<DeviceInstance, "id" | "name" | "bed_location_id">;
  canUpdate: boolean;
}

export function DeviceBedSelect({ device, canUpdate }: DeviceBedSelectProps) {
  const qc = useQueryClient();
  const locations = useQuery({
    queryKey: ["setup-locations"],
    queryFn: () => settingsSetupService.listLocations(),
    staleTime: 300_000,
  });
  const beds = useMemo(
    () =>
      (locations.data ?? [])
        .filter((l) => l.level === "bed" && l.is_active)
        .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
    [locations.data],
  );
  const assign = useMutation({
    mutationFn: (bed: string | null) => adminDevicesService.assignDeviceBed(device.id, bed),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["devices", "instances"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Bed not assigned" }),
  });
  return (
    <Select
      aria-label={`Bed for ${device.name}`}
      placeholder={locations.isError ? "Beds could not be loaded" : "No bed"}
      data={beds}
      value={device.bed_location_id}
      onChange={(v) => assign.mutate(v)}
      searchable
      clearable
      disabled={!canUpdate || assign.isPending}
      size="xs"
      w={200}
    />
  );
}
