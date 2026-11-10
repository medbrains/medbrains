/**
 * The building-block catalogue (RFC §11.3): every block MedBrains has
 * registered and tested, searchable, each with what it does, who holds it
 * and the permission that role needs. A designer can place nothing else.
 */
import { Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FlowBlock } from "@medbrains/types";
import { IconBolt, IconSearch, IconTrafficLights, IconUserCheck } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Badge, Card, Input, Modal } from "@/components/ui";
import styles from "./builder.module.scss";

const KIND = {
  signal: { Icon: IconTrafficLights, label: "Signal: holds until something is recorded" },
  task: { Icon: IconUserCheck, label: "Task: someone does it on a screen" },
  action: { Icon: IconBolt, label: "Action: runs a step with its own checks" },
} as const;

export interface BlockCatalogueProps {
  opened: boolean;
  /** Where the block will go, in words ("after Pharmacy returns"). */
  where: string;
  blocks: FlowBlock[];
  onPick: (block: FlowBlock) => void;
  onClose: () => void;
}

export function BlockCatalogue({ opened, where, blocks, onPick, onClose }: BlockCatalogueProps) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter((b) =>
      [b.name, b.does, b.holder].some((t) => t.toLowerCase().includes(q)),
    );
  }, [blocks, query]);

  return (
    <Modal opened={opened} onClose={onClose} title={`Add a station ${where}`} size="lg">
      <Stack gap="sm">
        <Input
          label="Search building blocks"
          placeholder="Physiotherapy, billing, sign-off…"
          leftSection={<IconSearch size={16} aria-hidden />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          data-autofocus
        />
        <Text size="xs" c="dimmed" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "block" : "blocks"}
        </Text>
        <ScrollArea.Autosize mah="60vh">
          <Stack gap="xs" aria-label="Building blocks">
            {shown.map((b) => {
              const { Icon, label } = KIND[b.kind];
              return (
                <UnstyledButton
                  key={`${b.kind}:${b.code}`}
                  className={styles.block}
                  onClick={() => onPick(b)}
                  aria-label={`${b.name}. ${b.does} Held by ${b.holder}.`}
                >
                  <Card withBorder padding="sm">
                    <Stack gap={4}>
                      <Group gap="xs" wrap="nowrap">
                        <Icon size={20} aria-hidden />
                        <Text fw={600}>{b.name}</Text>
                      </Group>
                      <Text size="sm">{b.does}</Text>
                      <Group gap="xs">
                        <Badge tone="neutral">{label}</Badge>
                        <Badge tone="info">Held by {b.holder}</Badge>
                        <Text size="xs" ff="monospace" c="dimmed">
                          Needs {b.permission}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                </UnstyledButton>
              );
            })}
            {shown.length === 0 && (
              <Text size="sm" c="dimmed">
                No block matches. Only registered, tested blocks can be placed; ask MedBrains for a
                new one.
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}
