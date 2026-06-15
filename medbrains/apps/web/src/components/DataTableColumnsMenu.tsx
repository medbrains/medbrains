import { Menu } from "@mantine/core";
import { IconLayoutColumns } from "@tabler/icons-react";
import { Checkbox, IconButton } from "@/components/ui";

export interface ColumnsMenuItem {
  key: string;
  label: string;
  hidden: boolean;
}

interface DataTableColumnsMenuProps {
  items: ColumnsMenuItem[];
  onToggle: (key: string) => void;
}

/** Column-visibility menu — toggles hideable columns; stays open while toggling. */
export function DataTableColumnsMenu({ items, onToggle }: DataTableColumnsMenuProps) {
  if (items.length === 0) return null;
  return (
    <Menu shadow="md" width={220} position="bottom-end" closeOnItemClick={false}>
      <Menu.Target>
        <IconButton aria-label="Choose columns" tone="default">
          <IconLayoutColumns size={16} />
        </IconButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Columns</Menu.Label>
        {items.map((item) => (
          <Menu.Item key={item.key} onClick={() => onToggle(item.key)}>
            <Checkbox label={item.label} checked={!item.hidden} readOnly size="xs" />
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
