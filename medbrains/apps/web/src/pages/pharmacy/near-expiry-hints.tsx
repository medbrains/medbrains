// IPD NearExpiryHints — split from pharmacy.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Table } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { ExpiryCell, renderPharmacySensitiveValue } from "./shared";

export function NearExpiryHints({ drugNames }: { drugNames: string[] }) {
  // FEFO suggestions on the dispensing screen: which batches of these drugs
  // expire soonest. The report is served under pharmacy.stock.manage, which a
  // dispensing pharmacist need not hold. Refused, `rows` is empty, `relevant`
  // is empty and the early return removes the block — the earliest-expiry
  // guidance simply is not there, with nothing on screen to say so.
  const canReadStock = useHasPermission(P.PHARMACY.STOCK_MANAGE);
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const nameSet = useMemo(() => new Set(drugNames.map((n) => n.toLowerCase())), [drugNames]);
  const { data: rows = [] } = useQuery({
    queryKey: ["pharmacy-near-expiry-hints"],
    queryFn: () => pharmacyService.getNearExpiryReport({ days: "180" }),
    enabled: drugNames.length > 0 && canReadStock,
  });
  const relevant = rows.filter((r) => nameSet.has(r.drug_name.toLowerCase())).slice(0, 8);
  if (relevant.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        FEFO suggestions — earliest-expiry batches in stock
      </Text>
      <Table withRowBorders={false}>
        <Table.Tbody>
          {relevant.map((r) => (
            <Table.Tr key={`${r.drug_name}-${r.batch_number}`}>
              <Table.Td>
                <Text size="xs">{r.drug_name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" ff="monospace">
                  Batch {renderPharmacySensitiveValue(batchNumberAccess, r.batch_number)}
                </Text>
              </Table.Td>
              <Table.Td>
                <ExpiryCell date={r.expiry_date} />
              </Table.Td>
              <Table.Td>
                <Text size="xs">on-hand: {r.quantity_on_hand}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
