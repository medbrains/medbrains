/**
 * FloorMapTable — the FloorMap's accessible twin: the same zones as rows, with
 * the band written as a word. It is the keyboard surface of the map: Tab to a
 * zone's button, and the map highlights it; Enter (or a click) inspects it.
 */
import { Text } from "@mantine/core";
import { Button } from "./Button";
import type { FloorMapZone } from "./FloorMap";
import { Table } from "./Table";

export interface FloorMapTableProps {
  zones: FloorMapZone[];
  caption: string;
  metricLabel: string;
  selectedId?: string | null;
  /** Absent on a wall board: rows are read, not pressed. */
  onZoneSelect?: (id: string) => void;
  onZoneFocus?: (id: string) => void;
}

const count = (n: number | null) => (n === null ? "Unknown" : String(n));

export function FloorMapTable({
  zones,
  caption,
  metricLabel,
  selectedId = null,
  onZoneSelect,
  onZoneFocus,
}: FloorMapTableProps) {
  return (
    <Table captionSide="top">
      <Table.Caption>{caption}</Table.Caption>
      <Table.Thead>
        <Table.Tr>
          <Table.Th scope="col">Zone</Table.Th>
          <Table.Th scope="col">Level</Table.Th>
          <Table.Th scope="col">{metricLabel}</Table.Th>
          <Table.Th scope="col">Waiting</Table.Th>
          <Table.Th scope="col">Staff on duty</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {zones.map((z) => (
          <Table.Tr key={z.id} aria-selected={z.id === selectedId}>
            <Table.Td onFocus={() => onZoneFocus?.(z.id)}>
              {onZoneSelect ? (
                <Button
                  tone="ghost"
                  size="xs"
                  onClick={() => onZoneSelect(z.id)}
                  aria-label={`Inspect ${z.name}`}
                  data-testid={`flow-zone-${z.id}`}
                >
                  {z.name}
                </Button>
              ) : (
                z.name
              )}
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={z.band !== null && z.band >= 3 ? 700 : 400}>
                {z.bandLabel}
              </Text>
            </Table.Td>
            <Table.Td>{z.metric}</Table.Td>
            <Table.Td>{count(z.queue)}</Table.Td>
            <Table.Td>{count(z.staff)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
