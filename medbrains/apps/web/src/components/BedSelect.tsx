import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type AvailableBed, P } from "@medbrains/types";
import { IconBed, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { lookupsService } from "../services/lookups.service";
import { MiniAddBed } from "./Ipd/MiniAddBed";
import { SearchOrCreate } from "./SearchOrCreate";

interface BedSelectProps {
  value: string;
  onChange: (bedId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
  wardId?: string;
}

export function BedSelect({
  value,
  onChange,
  label = "Bed",
  placeholder = "Select available bed...",
  required,
  size = "sm",
  clearable = true,
  error,
  wardId,
}: BedSelectProps) {
  const [search, setSearch] = useState("");
  const canCreateLocation = useHasPermission(P.ADMIN.SETTINGS.LOCATIONS.CREATE);
  const canManageWardBeds = useHasPermission(P.IPD.WARDS_MANAGE);
  const canCreate = canCreateLocation && (!wardId || canManageWardBeds);

  const { data: beds = [] } = useQuery({
    queryKey: ["available-beds", wardId],
    queryFn: () => lookupsService.listAvailableBeds(wardId ? { ward_id: wardId } : undefined),
    staleTime: 30_000,
  });

  const selectedBed = beds.find((bed: AvailableBed) => bed.bed_id === value);
  const visibleBeds = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return beds;
    }

    return beds.filter(
      (bed: AvailableBed) =>
        bed.bed_number.toLowerCase().includes(needle) ||
        (bed.ward_name ?? "").toLowerCase().includes(needle) ||
        (bed.room_number ?? "").toLowerCase().includes(needle),
    );
  }, [beds, search]);

  return (
    <SearchOrCreate<AvailableBed>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={
        selectedBed?.ward_name
          ? `${selectedBed.bed_number} — ${selectedBed.ward_name}`
          : selectedBed?.bed_number
      }
      items={visibleBeds}
      getItemValue={(bed) => bed.bed_id}
      getItemDisplay={(bed) =>
        bed.ward_name ? `${bed.bed_number} — ${bed.ward_name}` : bed.bed_number
      }
      renderItem={(bed) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {bed.bed_number}
          </Text>
          <Text size="xs" c="dimmed">
            {[bed.ward_name, bed.room_number, bed.bed_type].filter(Boolean).join(" · ") ||
              "Unassigned"}
          </Text>
        </Stack>
      )}
      onSelect={(bed) => onChange(bed.bed_id)}
      onClear={() => {
        if (clearable) {
          onChange("");
        }
      }}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={0}
      required={required}
      size={size}
      error={error}
      leftSection={<IconBed size={14} />}
      emptyLabel="No available beds"
      typeToSearchLabel="No available beds"
      canCreate={canCreate}
      createButtonIcon={<IconPlus size={14} />}
      createButtonLabel="Add bed"
      createModalTitle="Add bed"
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniAddBed
          searchText={searchText}
          wardId={wardId}
          onCancel={close}
          onCreated={selectItem}
        />
      )}
    />
  );
}
