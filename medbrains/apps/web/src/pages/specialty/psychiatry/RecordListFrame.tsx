import { Group, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Button } from "@/components/ui";

/**
 * One psychiatric record's child list (assessments, ECT, restraint, …).
 * The fetch is not issued without the list permission, and an error is
 * shown as an error — never as an empty register.
 */
export function usePsychList<T>(
  name: string,
  psychPatientId: string,
  fetcher: (psychPatientId: string) => Promise<T[]>,
  canList: boolean,
) {
  return useQuery({
    queryKey: [name, psychPatientId],
    queryFn: () => fetcher(psychPatientId),
    enabled: canList,
  });
}

interface RecordListFrameProps<T> {
  description: string;
  addLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  columns: Column<T>[];
  query: UseQueryResult<T[], Error>;
  emptyTitle: string;
  children?: ReactNode;
}

export function RecordListFrame<T extends { id: string }>({
  description,
  addLabel,
  canAdd,
  onAdd,
  columns,
  query,
  emptyTitle,
  children,
}: RecordListFrameProps<T>) {
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        {canAdd && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.id}
        emptyTitle={emptyTitle}
      />
      {children}
    </Stack>
  );
}
