import { Popover, ScrollArea, Stack, Tabs, Text, TextInput, UnstyledButton } from "@mantine/core";
import type { MappingOperationType, OperationCategory } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useMemo, useState } from "react";
import {
  getOperationsByCategory,
  OPERATION_CATEGORIES,
  OPERATION_DESCRIPTORS,
} from "./operationRegistry";

interface OperationPickerProps {
  onSelect: (type: MappingOperationType) => void;
  children: ReactNode;
}

export function OperationPicker({ onSelect, children }: OperationPickerProps) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("string");

  const filteredOps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return getOperationsByCategory(tab as OperationCategory);
    return OPERATION_DESCRIPTORS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.type.includes(q),
    );
  }, [search, tab]);

  const handleSelect = (type: MappingOperationType) => {
    onSelect(type);
    setOpened(false);
    setSearch("");
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={340}
      position="bottom-start"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <button
          type="button"
          onClick={() => setOpened((v) => !v)}
          style={{ all: "unset", cursor: "pointer" }}
        >
          {children}
        </button>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Stack gap={0}>
          <TextInput
            size="xs"
            placeholder="Search operations..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            m="xs"
            mb={0}
          />

          {!search && (
            <Tabs value={tab} onChange={(v) => setTab(v ?? "string")} variant="outline">
              <Tabs.List grow>
                {OPERATION_CATEGORIES.map((cat) => (
                  <Tabs.Tab key={cat.key} value={cat.key} p={6} fz="xs">
                    {cat.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          )}

          <ScrollArea.Autosize mah={280}>
            <Stack gap={0} p={4}>
              {filteredOps.map((op) => (
                <UnstyledButton
                  key={op.type}
                  onClick={() => handleSelect(op.type)}
                  px="xs"
                  py={6}
                  style={{
                    borderRadius: 4,
                    "&:hover": {
                      background: "var(--mantine-color-gray-0)",
                    },
                  }}
                  className="operation-picker-item"
                >
                  <Text size="xs" fw={500}>
                    {op.label}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {op.description}
                  </Text>
                </UnstyledButton>
              ))}
              {filteredOps.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  No operations found
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
