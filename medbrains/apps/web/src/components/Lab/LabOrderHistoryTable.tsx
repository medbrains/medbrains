import { Text } from "@mantine/core";
import type { PatientLabOrderRow } from "@medbrains/types";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Fragment, useState } from "react";
import { Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { LabOrderResults } from "./LabOrderResults";

const LAB_STATUS_TONES: Record<string, BadgeTone> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "success",
  verified: "success",
  cancelled: "danger",
};

const COLUMN_COUNT = 5;

/**
 * Where an order has got to, in the words a clinician would use. Elapsed time
 * is shown against the catalogue's expected turnaround when one is stated.
 */
function orderProgress(order: PatientLabOrderRow): string {
  // A rejected sample is a note on the order, not a status — somebody has to
  // go and draw blood again, so it is shown first.
  if (order.rejection_reason) return `Sample rejected — ${order.rejection_reason}`;
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "verified") {
    const when = order.verified_at ?? order.updated_at;
    return `Verified ${new Date(when).toLocaleString()} · ${order.result_count ?? 0} value(s)`;
  }
  const startedAt = order.collected_at ?? order.created_at;
  const mins = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const elapsed = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
  const stage = order.collected_at ? "In the lab" : "Sample not collected";
  const target = order.expected_tat_minutes;
  const against = target ? ` · expected ${target} min${mins > target ? " — overdue" : ""}` : "";
  return `${stage} · ${elapsed}${against}`;
}

/** Opens an order's values in place; says "Awaiting result" when there are none. */
export function ResultsToggle({
  count,
  isOpen,
  onToggle,
}: {
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (count === 0) {
    // A button that opens an empty report teaches the clinician not to press it.
    return (
      <Text size="xs" c="dimmed">
        Awaiting result
      </Text>
    );
  }
  return (
    <Button
      tone="secondary"
      size="xs"
      aria-expanded={isOpen}
      leftSection={isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
      onClick={onToggle}
    >
      {isOpen ? "Hide results" : `Show results (${count})`}
    </Button>
  );
}

/** Which rows are open — several may be, so values can be compared. */
export function useToggleSet(): [ReadonlySet<string>, (id: string) => void] {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return [openIds, toggle];
}

/**
 * A patient's lab orders, each openable in place to its result values.
 *
 * Results load only for the rows a clinician opens (one request per opened
 * order), so the list itself stays one round trip.
 */
export function LabOrderHistoryTable({ orders }: { orders: PatientLabOrderRow[] }) {
  const [openIds, toggle] = useToggleSet();

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Test</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Ordered by</Table.Th>
          <Table.Th>Ordered</Table.Th>
          <Table.Th>Results</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {orders.map((order) => {
          const isOpen = openIds.has(order.id);
          const count = order.result_count ?? 0;
          return (
            <Fragment key={order.id}>
              <Table.Tr>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {order.test_name ?? "Lab test"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {orderProgress(order)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={LAB_STATUS_TONES[order.status] ?? "neutral"}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{order.ordered_by_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(order.created_at).toLocaleDateString()}</Text>
                </Table.Td>
                <Table.Td>
                  <ResultsToggle count={count} isOpen={isOpen} onToggle={() => toggle(order.id)} />
                </Table.Td>
              </Table.Tr>
              {isOpen && (
                <Table.Tr>
                  <Table.Td colSpan={COLUMN_COUNT}>
                    <LabOrderResults orderId={order.id} />
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
