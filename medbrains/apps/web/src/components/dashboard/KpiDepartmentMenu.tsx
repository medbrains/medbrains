import { Menu } from "@mantine/core";
import type { DepartmentRow } from "@medbrains/types";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { useWidgetFilterStore } from "./widget-filter-store";

interface Props {
  widgetId: string;
  /** The widget, for the control's name. */
  title: string;
}

/** Narrow one KPI tile to a department, or back to the whole hospital. */
export function KpiDepartmentMenu({ widgetId, title }: Props) {
  const chosen = useWidgetFilterStore((s) => s.filters[widgetId]?.department_id ?? null);
  const setDepartment = useWidgetFilterStore((s) => s.setDepartment);
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const clinical = (departments as DepartmentRow[]).filter((d) =>
    ["clinical", "para_clinical"].includes(d.department_type ?? ""),
  );
  const current = clinical.find((d) => d.id === chosen)?.name ?? "All departments";
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Button
          tone="ghost"
          size="compact-xs"
          rightSection={<IconChevronDown size={12} />}
          aria-label={`Department for ${title}: ${current}`}
          maw={150}
        >
          {current}
        </Button>
      </Menu.Target>
      <Menu.Dropdown mah={320} style={{ overflowY: "auto" }}>
        <Menu.Label>Department</Menu.Label>
        <Menu.Item
          onClick={() => setDepartment(widgetId, null)}
          rightSection={chosen === null ? <IconCheck size={14} aria-hidden /> : null}
        >
          All departments
        </Menu.Item>
        {clinical.map((d) => (
          <Menu.Item
            key={d.id}
            onClick={() => setDepartment(widgetId, d.id)}
            rightSection={d.id === chosen ? <IconCheck size={14} aria-hidden /> : null}
          >
            {d.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
