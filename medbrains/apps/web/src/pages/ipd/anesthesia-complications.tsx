// IPD AnesthesiaComplicationsReport — split from ipd.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { AnesthesiaComplicationEntry } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useProtectedFieldAccess } from "@/components";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { protectedIpdPatientName } from "./shared";

export function AnesthesiaComplicationsReport({ from, to }: { from: string; to: string }) {
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const { data, isLoading } = useQuery({
    queryKey: ["ot-anesthesia-complications", from, to],
    queryFn: () =>
      ipdService.listAnesthesiaComplications({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as AnesthesiaComplicationEntry[];

  return (
    <Stack>
      <Text fw={500}>Anesthesia Complications</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No anesthesia complications recorded in this period.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Anesthesia Type</Table.Th>
              <Table.Th>Complications</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const patientName = protectedIpdPatientName(r.patient_name, patientNameAccess);

              return (
                <Table.Tr key={r.case_id}>
                  <Table.Td>
                    <Text size="sm">{r.case_date}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {patientName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.procedure_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{r.anesthesia_type}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="danger" lineClamp={2}>
                      {r.complications ?? "—"}
                    </Text>
                    {r.adverse_events != null && typeof r.adverse_events === "object" ? (
                      <Badge size="xs" tone="danger" mt={2}>
                        Has adverse events
                      </Badge>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
