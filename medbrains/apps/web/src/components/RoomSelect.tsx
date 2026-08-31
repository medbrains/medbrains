import { Stack, Text } from "@mantine/core";
import type { LocationDirectoryRow } from "@medbrains/types";
import { IconDoor } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { settingsSetupService } from "@/services/settingsSetup.service";
import { SearchOrCreate } from "./SearchOrCreate";

interface RoomSelectProps {
  value: string;
  onChange: (locationId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: string;
  error?: string;
  /**
   * Which levels of the location tree to offer. Rooms by default — a station
   * sits in a room, not on a floor — but the bed-level surfaces need `bed`,
   * and a mobile counter may only be placeable to a wing.
   */
  levels?: readonly string[];
}

/**
 * Picks a physical place out of the location hierarchy.
 *
 * Reads the directory endpoint rather than the flat list because that one
 * returns the breadcrumb: two hospitals both have an "OPD Consultation Room 3"
 * and the only thing telling them apart is which building they are in. A bare
 * name in this dropdown is how a counter gets assigned to the wrong campus.
 */
export function RoomSelect({
  value,
  onChange,
  label = "Room",
  placeholder = "Select a room...",
  required,
  disabled,
  size = "sm",
  error,
  levels = ["room"],
}: RoomSelectProps) {
  const [search, setSearch] = useState("");

  const { data: directory = [] } = useQuery({
    queryKey: ["location-directory"],
    queryFn: () => settingsSetupService.listLocationDirectory(),
    staleTime: 600_000,
  });

  const rooms = useMemo(
    () => directory.filter((row: LocationDirectoryRow) => levels.includes(row.level)),
    [directory, levels],
  );

  const selected = rooms.find((room) => room.id === value);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rooms;
    // Match the breadcrumb too, so "ground floor" narrows to that floor's
    // rooms without anyone having to remember their codes.
    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(needle) ||
        room.code.toLowerCase().includes(needle) ||
        room.full_path.toLowerCase().includes(needle),
    );
  }, [rooms, search]);

  return (
    <SearchOrCreate<LocationDirectoryRow>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={selected?.name}
      items={visible}
      getItemValue={(room) => room.id}
      getItemDisplay={(room) => room.name}
      renderItem={(room) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {room.name}
          </Text>
          <Text size="xs" c="dimmed">
            {room.code} · {room.full_path}
          </Text>
        </Stack>
      )}
      onSelect={(room) => onChange(room.id)}
      onClear={() => onChange("")}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={0}
      required={required}
      disabled={disabled}
      size={size}
      error={error}
      leftSection={<IconDoor size={14} />}
      emptyLabel="No rooms found"
      typeToSearchLabel="No rooms found"
    />
  );
}
