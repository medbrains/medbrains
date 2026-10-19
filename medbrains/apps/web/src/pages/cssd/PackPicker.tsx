/**
 * Choose the sterile pack being issued: its load, then the pack.
 *
 * Packs the server will refuse (expired, failed indicator, unfinished or
 * recalled load, already issued) are listed but disabled, with the reason in
 * words. The server makes the same check on issue; this only shows it early.
 */
import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Select } from "@/components/ui";
import { cssdService } from "@/services/cssd.service";
import { blockedPacks, packLabel } from "./pack-status";

interface PackPickerProps {
  loadId: string;
  packId: string;
  onLoadChange: (loadId: string) => void;
  onPackChange: (packId: string) => void;
  loadError?: string;
  packError?: string;
}

export function PackPicker({
  loadId,
  packId,
  onLoadChange,
  onPackChange,
  loadError,
  packError,
}: PackPickerProps) {
  const canListLoads = useHasPermission(P.CSSD.STERILIZATION_LIST);
  const canListSets = useHasPermission(P.CSSD.SETS_LIST);

  const loads = useQuery({
    queryKey: ["cssd-loads"],
    queryFn: () => cssdService.listCssdLoads(),
    enabled: canListLoads,
  });
  const packs = useQuery({
    queryKey: ["cssd-load-items", loadId],
    queryFn: () => cssdService.listCssdLoadItems(loadId),
    enabled: canListLoads && loadId.length > 0,
  });
  const { data: sets = [] } = useQuery({
    queryKey: ["cssd-sets"],
    queryFn: () => cssdService.listCssdSets(),
    enabled: canListSets,
  });

  const setNames = useMemo(() => new Map(sets.map((s) => [s.id, s.set_name])), [sets]);
  const packRows = packs.data ?? [];
  const blocked = useMemo(() => blockedPacks(packs.data ?? []), [packs.data]);

  if (!canListLoads) {
    return (
      <Alert tone="warning" title="Packs cannot be listed for this role">
        Choosing a pack needs the sterilisation-log permission (cssd.sterilization.list). Ask CSSD
        to issue the pack.
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Select
        label="Sterilisation load"
        placeholder="Choose the load the pack came from"
        required
        searchable
        data={(loads.data ?? []).map((l) => ({
          value: l.id,
          label: l.recalled_at ? `${l.load_number} (recalled)` : `${l.load_number} · ${l.status}`,
        }))}
        value={loadId || null}
        onChange={(value) => {
          onLoadChange(value ?? "");
          onPackChange("");
        }}
        error={loads.isError ? "Loads could not be read. Try again." : loadError}
      />
      {loadId &&
        (packs.isError ? (
          <Alert tone="danger" title="Packs could not be read">
            This is a failed read, not an empty load. Try again before issuing.
          </Alert>
        ) : (
          <Select
            label="Pack"
            placeholder={packs.isLoading ? "Reading packs…" : "Choose the pack"}
            required
            data={packRows.map((p) => ({
              value: p.id,
              label: packLabel(p, setNames.get(p.set_id ?? "")),
              disabled: p.block_reason !== null,
            }))}
            value={packId || null}
            onChange={(value) => onPackChange(value ?? "")}
            error={packError}
          />
        ))}
      {blocked.length > 0 && (
        <Alert tone="warning" title="Packs that cannot be issued">
          <Stack gap={4}>
            {blocked.map((p) => (
              <Text key={p.id} size="sm">
                {setNames.get(p.set_id ?? "") ?? "Pack"}: {p.block_reason}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
