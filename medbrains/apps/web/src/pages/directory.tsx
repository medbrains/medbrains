import { Group, Stack, Text, TextInput } from "@mantine/core";
import type { LocationDirectoryRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconMapPin, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { settingsSetupService } from "@/services/settingsSetup.service";

export function DirectoryPage() {
  useRequirePermission(P.ADMIN.SETTINGS.LOCATIONS.LIST);
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["location-directory"],
    queryFn: () => settingsSetupService.listLocationDirectory(),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (r) => r.full_path.toLowerCase().includes(term) || r.code.toLowerCase().includes(term),
    );
  }, [data, q]);

  const columns: Column<LocationDirectoryRow>[] = [
    {
      key: "name",
      label: "Location",
      render: (r) => (
        <Group gap={6}>
          <IconMapPin size={14} />
          <Text size="sm" fw={500}>
            {r.name}
          </Text>
        </Group>
      ),
    },
    {
      key: "level",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {r.level}
        </Badge>
      ),
    },
    {
      key: "full_path",
      label: "Where to find it",
      render: (r) => (
        <Text size="xs" c="dimmed">
          {r.full_path}
        </Text>
      ),
    },
    {
      key: "code",
      label: "Code",
      render: (r) => (
        <Text size="xs" ff="monospace">
          {r.code}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Directory"
        subtitle="Find any ward, room or location and how to reach it"
      />
      <TextInput
        placeholder="Search a ward, room or location…"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        maw={420}
        aria-label="Search the location directory"
      />
      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No locations found."
      />
    </Stack>
  );
}
