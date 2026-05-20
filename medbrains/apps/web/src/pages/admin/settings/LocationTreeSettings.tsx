import { Accordion, Badge, Group, Loader, Stack, Text } from "@mantine/core";
import type { LocationRow } from "@medbrains/types";
import { IconMapPin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { settingsSetupService } from "../../../services/settingsSetup.service";

interface LocationNode extends LocationRow {
  children: LocationNode[];
}

const buildTree = (locations: LocationRow[]): LocationNode[] => {
  const map = new Map<string, LocationNode>();
  const roots: LocationNode[] = [];

  locations.forEach((loc) => {
    map.set(loc.id, { ...loc, children: [] });
  });

  locations.forEach((loc) => {
    const node = map.get(loc.id);
    if (!node) return;

    if (loc.parent_id) {
      const parent = map.get(loc.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: LocationNode[]): LocationNode[] => {
    return nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        ...n,
        children: sortNodes(n.children),
      }));
  };

  return sortNodes(roots);
};

const LEVEL_COLORS: Record<string, string> = {
  campus: "primary",
  building: "teal",
  floor: "info",
  wing: "violet",
  room: "violet",
};

interface LocationNodeItemProps {
  node: LocationNode;
  depth: number;
}

function LocationNodeItem({ node, depth }: LocationNodeItemProps) {
  if (node.children.length === 0) {
    return (
      <Group gap="sm" py="xs" pl={depth * 20}>
        <IconMapPin size={16} />
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {node.name}
          </Text>
          <Text size="xs" c="dimmed">
            {node.code}
          </Text>
        </div>
        <Badge size="sm" color={LEVEL_COLORS[node.level] || "slate"} variant="light">
          {node.level}
        </Badge>
        <Badge size="sm" color={node.is_active ? "success" : "slate"} variant="light">
          {node.is_active ? "Active" : "Inactive"}
        </Badge>
      </Group>
    );
  }

  return (
    <Accordion.Item key={node.id} value={node.id}>
      <Accordion.Control icon={<IconMapPin size={16} />}>
        <Group gap="sm">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {node.name}
            </Text>
            <Text size="xs" c="dimmed">
              {node.code}
            </Text>
          </div>
          <Badge size="sm" color={LEVEL_COLORS[node.level] || "slate"} variant="light">
            {node.level}
          </Badge>
          <Badge size="sm" color={node.is_active ? "success" : "slate"} variant="light">
            {node.is_active ? "Active" : "Inactive"}
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        {node.children.map((child) => (
          <LocationNodeItem key={child.id} node={child} depth={depth + 1} />
        ))}
      </Accordion.Panel>
    </Accordion.Item>
  );
}

const QUERY_KEY = ["setup-locations"];

export function LocationTreeSettings() {
  const {
    data: locations,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsSetupService.listLocations(),
  });

  const tree = useMemo(() => {
    if (!locations) return [];
    return buildTree(locations);
  }, [locations]);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading location hierarchy...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load locations: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Location Hierarchy
        </Text>
        <Group gap="xs">
          <Badge size="sm" color="primary" variant="light">
            Campus
          </Badge>
          <Badge size="sm" color="teal" variant="light">
            Building
          </Badge>
          <Badge size="sm" color="info" variant="light">
            Floor
          </Badge>
          <Badge size="sm" color="violet" variant="light">
            Wing
          </Badge>
          <Badge size="sm" color="violet" variant="light">
            Room
          </Badge>
        </Group>
      </Group>

      {tree.length > 0 ? (
        <Accordion multiple variant="separated" chevronPosition="left">
          {tree.map((node) => (
            <LocationNodeItem key={node.id} node={node} depth={0} />
          ))}
        </Accordion>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          No locations configured yet.
        </Text>
      )}
    </Stack>
  );
}
