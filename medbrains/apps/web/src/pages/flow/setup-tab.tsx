import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { FlowConfigZone } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Modal, Select, Table } from "@/components/ui";
import { flowKeys } from "./use-flow";
import { ZoneForm } from "./zone-form";

const orDash = (n: number | null) => (n === null ? "—" : String(n));

function feeds(zone: FlowConfigZone): string {
  if (zone.sources.length === 0) return "Nothing yet";
  return zone.sources
    .map((s) =>
      s.kind === "department"
        ? (s.department_name ?? "Department")
        : `${s.token_module} queue${s.counter_label ? ` · ${s.counter_label}` : ""}`,
    )
    .join(", ");
}

/**
 * Flow setup, for facilities: zones come from the location hierarchy (the
 * `zone` level under a floor); here each gets its limits, its factor, its
 * place on the map and what feeds it.
 */
export function SetupTab() {
  const floors = useQuery({ queryKey: flowKeys.configFloors, queryFn: api.listFlowConfigFloors });
  const [chosen, setChosen] = useState<string | null>(null);
  const floorId =
    chosen ?? floors.data?.find((f) => f.zone_count > 0)?.id ?? floors.data?.[0]?.id ?? null;
  const setup = useQuery({
    queryKey: flowKeys.setup(floorId ?? ""),
    queryFn: () => api.getFlowFloorSetup(floorId as string),
    enabled: Boolean(floorId),
  });
  const [editing, setEditing] = useState<FlowConfigZone | null>(null);

  if (floors.isError || setup.isError) {
    return (
      <Alert tone="danger">Flow setup could not be loaded. Nothing has changed; try again.</Alert>
    );
  }
  if (floors.data?.length === 0) {
    return (
      <Alert tone="info">
        No floors yet. Add the building, its floors and their zones in Settings → Locations; they
        appear here.
      </Alert>
    );
  }
  return (
    <Stack gap="md">
      <Select
        label="Floor"
        data={(floors.data ?? []).map((f) => ({
          value: f.id,
          label: `${f.building_name ? `${f.building_name} · ` : ""}${f.name} (${f.zone_count} zones)`,
        }))}
        value={floorId}
        onChange={setChosen}
        allowDeselect={false}
        w={320}
      />
      {setup.data?.zones.length === 0 && (
        <Alert tone="info">
          This floor has no zones. Add locations at the "zone" level under it in Settings →
          Locations.
        </Alert>
      )}
      {(setup.data?.zones.length ?? 0) > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Zone</Table.Th>
              <Table.Th scope="col">Comfort limit</Table.Th>
              <Table.Th scope="col">Capacity</Table.Th>
              <Table.Th scope="col">Attendant factor</Table.Th>
              <Table.Th scope="col">Wait goal</Table.Th>
              <Table.Th scope="col">Fed by</Table.Th>
              <Table.Th scope="col">
                <Text span size="sm" fw={600}>
                  Action
                </Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {setup.data?.zones.map((z) => (
              <Table.Tr key={z.location_id}>
                <Table.Td>
                  <Group gap="xs">
                    {z.name}
                    {!z.configured && <Badge tone="neutral">Not counted</Badge>}
                  </Group>
                </Table.Td>
                <Table.Td>{orDash(z.comfort_limit)}</Table.Td>
                <Table.Td>{orDash(z.capacity)}</Table.Td>
                <Table.Td>× {z.attendant_factor}</Table.Td>
                <Table.Td>
                  {z.goal_wait_minutes === null ? "—" : `${z.goal_wait_minutes} min`}
                </Table.Td>
                <Table.Td>{feeds(z)}</Table.Td>
                <Table.Td>
                  <Button
                    tone="tertiary"
                    size="xs"
                    onClick={() => setEditing(z)}
                    aria-label={`Set up ${z.name}`}
                  >
                    Set up
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Modal
        opened={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Set up ${editing.name}` : "Zone"}
        fullScreen
      >
        {editing && setup.data && (
          <ZoneForm zone={editing} setup={setup.data} onSaved={() => setEditing(null)} />
        )}
      </Modal>
    </Stack>
  );
}
