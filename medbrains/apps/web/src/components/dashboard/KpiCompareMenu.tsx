import { Menu } from "@mantine/core";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { KPI_BASELINES, type KpiBaseline } from "./kpi-reading";

interface Props {
  /** The widget, for the control's name. */
  title: string;
  value: KpiBaseline;
  onChange: (next: KpiBaseline) => void;
}

/** One tile's own "compare with" — the page sets the default. */
export function KpiCompareMenu({ title, value, onChange }: Props) {
  const current = KPI_BASELINES.find((b) => b.value === value)?.label ?? "";
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          tone="ghost"
          size="compact-xs"
          rightSection={<IconChevronDown size={12} />}
          aria-label={`Compare ${title} with: ${current}`}
        >
          vs {current.toLowerCase()}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Compare with</Menu.Label>
        {KPI_BASELINES.map((b) => (
          <Menu.Item
            key={b.value}
            onClick={() => onChange(b.value)}
            rightSection={b.value === value ? <IconCheck size={14} aria-hidden /> : null}
          >
            {b.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
