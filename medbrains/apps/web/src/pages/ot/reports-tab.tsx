// IPD OtReportsTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, TextInput } from "@mantine/core";
import type { OtUtilizationFilterFormInput } from "@medbrains/schemas";
import { otUtilizationFilterFormSchema } from "@medbrains/schemas";
import type { RoomUtilization } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Table } from "@/components/ui";
import { DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES, toOtUtilizationParams } from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

export function OtReportsTab() {
  const {
    control,
    formState: { errors },
  } = useForm<OtUtilizationFilterFormInput>({
    resolver: zodResolver(otUtilizationFilterFormSchema),
    defaultValues: DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES,
    mode: "onChange",
  });
  const watchedFilters = useWatch({ control });
  const filterValues: OtUtilizationFilterFormInput = {
    from: watchedFilters.from ?? "",
    to: watchedFilters.to ?? "",
  };
  const utilizationParams = toOtUtilizationParams(filterValues);

  const { data: rows = [], isLoading } = useQuery<RoomUtilization[]>({
    queryKey: ["ot-utilization", utilizationParams?.from ?? "", utilizationParams?.to ?? ""],
    queryFn: () => otService.otUtilization(utilizationParams),
    enabled: !errors.to,
  });

  return (
    <Stack>
      <Text fw={500} size="lg">
        OT Utilization Report
      </Text>
      <Group>
        <Controller
          control={control}
          name="from"
          render={({ field }) => (
            <TextInput label="From" type="date" error={errors.from?.message} w={180} {...field} />
          )}
        />
        <Controller
          control={control}
          name="to"
          render={({ field }) => (
            <TextInput label="To" type="date" error={errors.to?.message} w={180} {...field} />
          )}
        />
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No data for the selected period.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Room</Table.Th>
              <Table.Th>Total Bookings</Table.Th>
              <Table.Th>Total Surgery (min)</Table.Th>
              <Table.Th>Avg Turnaround (min)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.room_id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.room_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_bookings}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_surgery_minutes ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.avg_turnaround_minutes != null ? r.avg_turnaround_minutes.toFixed(1) : "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
