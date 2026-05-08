import {
  Accordion,
  Badge,
  Box,
  Group,
  Loader,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { api } from "@medbrains/api";
import type { IntegrationNodeTemplate, PipelineNodeType } from "@medbrains/types";
import {
  IconBolt,
  IconClock,
  IconGitBranch,
  IconGripVertical,
  IconPlayerPlay,
  IconSearch,
  IconTransform,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type DragEvent, useMemo, useState } from "react";

const NODE_TYPE_ICONS: Record<PipelineNodeType, typeof IconBolt> = {
  trigger: IconBolt,
  condition: IconGitBranch,
  action: IconPlayerPlay,
  transform: IconTransform,
  delay: IconClock,
};

const NODE_TYPE_COLORS: Record<PipelineNodeType, string> = {
  trigger: "primary",
  condition: "orange",
  action: "teal",
  transform: "violet",
  delay: "info",
};

const CATEGORY_ORDER = ["Triggers", "Logic", "Actions"];

function onDragStart(event: DragEvent, template: IntegrationNodeTemplate) {
  event.dataTransfer.setData("application/integration-node", JSON.stringify(template));
  event.dataTransfer.effectAllowed = "move";
}

export function NodePalette() {
  const [search, setSearch] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["integration", "node-templates"],
    queryFn: () => api.listNodeTemplates(),
  });

  const grouped = useMemo(() => {
    if (!templates) return {};
    const filtered = search
      ? templates.filter(
          (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.code.toLowerCase().includes(search.toLowerCase()),
        )
      : templates;
    const groups: Record<string, IntegrationNodeTemplate[]> = {};
    for (const t of filtered) {
      const cat = t.category ?? "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [templates, search]);

  const sortedCategories = useMemo(() => {
    const keys = Object.keys(grouped);
    return keys.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  if (isLoading) {
    return (
      <Box p="md" ta="center">
        <Loader size="sm" />
      </Box>
    );
  }

  return (
    <Box>
      <Group gap={6} mb="xs">
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Nodes
        </Text>
        <Badge size="xs" variant="light" color="slate">
          {templates?.length ?? 0}
        </Badge>
      </Group>
      <TextInput
        placeholder="Search nodes..."
        leftSection={<IconSearch size={14} />}
        size="xs"
        mb="sm"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <Accordion
        variant="filled"
        multiple
        defaultValue={CATEGORY_ORDER}
        styles={{
          item: { border: "none", background: "transparent" },
          content: { padding: "0 0 8px 0" },
          control: { padding: "4px 8px" },
        }}
      >
        {sortedCategories.map((category) => (
          <Accordion.Item key={category} value={category}>
            <Accordion.Control>
              <Group gap={6}>
                <Text size="xs" fw={700} tt="uppercase">
                  {category}
                </Text>
                <Badge size="xs" variant="light" color="slate" circle>
                  {grouped[category]?.length ?? 0}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {grouped[category]?.map((template) => {
                const Icon = NODE_TYPE_ICONS[template.node_type] ?? IconPlayerPlay;
                const nodeColor = template.color ?? NODE_TYPE_COLORS[template.node_type] ?? "slate";
                return (
                  <UnstyledButton
                    key={template.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, template)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "grab",
                      marginBottom: 2,
                      border: "1px solid var(--mantine-color-gray-2)",
                      background: "white",
                      width: "100%",
                      transition: "all 120ms ease",
                    }}
                    className="palette-node"
                    onMouseDown={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.12)";
                    }}
                    onMouseUp={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <IconGripVertical size={12} color="var(--mantine-color-gray-4)" />
                    <ThemeIcon variant="light" color={nodeColor} size="md" radius="md">
                      <Icon size={14} />
                    </ThemeIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={600} lh={1.2} truncate>
                        {template.name}
                      </Text>
                      {template.description && (
                        <Text size="xs" c="dimmed" lh={1.2} lineClamp={1} style={{ fontSize: 10 }}>
                          {template.description}
                        </Text>
                      )}
                    </Box>
                  </UnstyledButton>
                );
              })}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
