import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { IconButton, Modal } from "@/components/ui";
import type { AiWidget } from "../transport/types";
import { ChartWidget } from "./ChartWidget";
import { KpiWidget } from "./KpiWidget";
import { ListWidget } from "./ListWidget";
import { TableWidget } from "./TableWidget";
import styles from "./widgets.module.scss";

function Body({ widget, full }: { widget: AiWidget; full: boolean }) {
  switch (widget.kind) {
    case "kpis":
      return <KpiWidget widget={widget} />;
    case "table":
      return <TableWidget widget={widget} full={full} />;
    case "chart":
      return <ChartWidget widget={widget} full={full} />;
    case "list":
      return <ListWidget widget={widget} full={full} />;
  }
}

/**
 * One widget from the closed catalogue. Anything the narrow chat panel
 * compacts (tables, charts, lists) opens full screen; Esc or Close return to
 * the chat and focus goes back to the button.
 */
export function WidgetView({ widget }: { widget: AiWidget }) {
  const [opened, { open, close }] = useDisclosure(false);
  const expandable = widget.kind !== "kpis";
  return (
    <Stack gap={6} className={styles.widget} data-widget={widget.kind}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={600}>
          {widget.title}
        </Text>
        {expandable && (
          <IconButton aria-label="Open full screen" size="md" onClick={open}>
            <IconArrowsMaximize size={16} />
          </IconButton>
        )}
      </Group>
      <Body widget={widget} full={false} />
      {expandable && (
        <Modal opened={opened} onClose={close} title={widget.title} fullScreen>
          <Body widget={widget} full />
        </Modal>
      )}
    </Stack>
  );
}
