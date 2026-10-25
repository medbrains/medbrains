import { SimpleGrid } from "@mantine/core";
import { IconNumbers } from "@tabler/icons-react";
import { StatCard } from "@/components/StatCard";
import type { AiWidget } from "../transport/types";
import { formatValue } from "./format";

type Kpis = Extract<AiWidget, { kind: "kpis" }>;

/** Headline numbers on the dashboard's own stat tiles, exactly as recorded. */
export function KpiWidget({ widget }: { widget: Kpis }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
      {widget.tiles.map((tile) => (
        <StatCard
          key={tile.label}
          label={tile.label}
          value={formatValue(tile.value, tile.money)}
          icon={<IconNumbers size={20} aria-hidden />}
        />
      ))}
    </SimpleGrid>
  );
}
