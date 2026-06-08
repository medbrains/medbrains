import { Badge, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type AvailableBed, P } from "@medbrains/types";
import { IconBed, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { lookupsService } from "@/services/lookups.service";
import { MiniAddBed } from "./Ipd/MiniAddBed";
import { OperationalSignal } from "./OperationalSignal";
import { SearchOrCreate } from "./SearchOrCreate";

interface BedSelectProps {
  value: string;
  onChange: (bedId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  enabled?: boolean;
  error?: string;
  wardId?: string;
}

export function BedSelect({
  value,
  onChange,
  label,
  placeholder,
  required,
  size = "sm",
  clearable = true,
  enabled = true,
  error,
  wardId,
}: BedSelectProps) {
  const { t } = useTranslation("ipd");
  const [search, setSearch] = useState("");
  const canCreateLocation = useHasPermission(P.ADMIN.SETTINGS.LOCATIONS.CREATE);
  const canManageWardBeds = useHasPermission(P.IPD.WARDS_MANAGE);
  const canCreate = canCreateLocation && (!wardId || canManageWardBeds);

  const { data: beds = [] } = useQuery({
    queryKey: ["available-beds", wardId],
    queryFn: () => lookupsService.listAvailableBeds(wardId ? { ward_id: wardId } : undefined),
    enabled,
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

  function bedDisplayText(bed: AvailableBed): string {
    return [
      bed.bed_number,
      bed.ward_name ?? t("bedSelect.unassigned"),
      bed.room_number ? t("bedSelect.room", { room: bed.room_number }) : null,
      bed.bed_type ? t("bedSelect.type", { type: bed.bed_type }) : null,
      bed.is_isolation ? t("bedSelect.isolation") : null,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  function bedContextText(bed: AvailableBed): string {
    return [
      bed.ward_name ?? t("bedSelect.unassigned"),
      bed.room_number ? t("bedSelect.room", { room: bed.room_number }) : null,
      bed.bed_type ? t("bedSelect.type", { type: bed.bed_type }) : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return (
    <SearchOrCreate<AvailableBed>
      label={label ?? t("bedSelect.label")}
      placeholder={placeholder ?? t("bedSelect.placeholder")}
      value={value}
      selectedDisplay={selectedBed ? bedDisplayText(selectedBed) : undefined}
      items={visibleBeds}
      getItemValue={(bed) => bed.bed_id}
      getItemDisplay={bedDisplayText}
      renderItem={(bed) => (
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <OperationalSignal
            label={t("bedSelect.available")}
            shape="bed"
            size="xs"
            tone="ready"
            value={bed.bed_number}
          />
          <Stack gap={3} miw={0}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate>
                {bed.ward_name ?? t("bedSelect.unassigned")}
              </Text>
              {bed.is_isolation && (
                <Badge size="xs" color="yellow" variant="light">
                  {t("bedSelect.isolation")}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {bedContextText(bed)}
            </Text>
          </Stack>
        </Group>
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
      emptyLabel={t("bedSelect.noAvailableBeds")}
      typeToSearchLabel={t("bedSelect.noAvailableBeds")}
      canCreate={canCreate}
      createButtonIcon={<IconPlus size={14} />}
      createButtonLabel={t("bedSelect.addBed")}
      createModalTitle={t("bedSelect.addBed")}
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
