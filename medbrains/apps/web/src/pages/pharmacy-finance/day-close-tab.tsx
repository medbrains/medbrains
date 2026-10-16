/**
 * Every counter day of the last month, the ones still waiting to be closed
 * first in mind: pick one to see its Z-report and count it.
 */
import { Stack, Text } from "@mantine/core";
import type { CounterDay, FieldAccessLevel } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Drawer } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { DayClosePanel } from "./day-close-panel";
import { financeAmountText } from "./shared";

const STATUS_TONE = { open: "warning", closed: "success", reopened: "danger" } as const;
const STATUS_LABEL = { open: "Not closed", closed: "Closed", reopened: "Reopened" } as const;

export function DayCloseTab({ amountAccess }: { amountAccess: FieldAccessLevel }) {
  const [picked, setPicked] = useState<CounterDay | null>(null);
  const days = useQuery({
    queryKey: ["pharmacy-day-close", "list"],
    queryFn: () => pharmacyFinanceService.listCounterDays(),
  });

  if (days.isError) {
    // An outage is not "no counter days": say we cannot tell.
    return (
      <Alert tone="danger" role="alert" title="Could not load the counter days">
        {days.error.message}
      </Alert>
    );
  }

  const columns = [
    { key: "business_date", label: "Day", render: (r: CounterDay) => r.business_date },
    {
      key: "location_name",
      label: "Counter",
      render: (r: CounterDay) => r.location_name ?? "—",
    },
    {
      key: "drawers",
      label: "Drawers",
      render: (r: CounterDay) =>
        r.open_drawers > 0 ? `${r.drawers} (${r.open_drawers} open)` : String(r.drawers),
    },
    {
      key: "status",
      label: "Status",
      render: (r: CounterDay) => (
        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
    {
      key: "variance",
      label: "Variance",
      render: (r: CounterDay) =>
        r.variance == null ? "—" : financeAmountText(amountAccess, r.variance),
    },
    {
      key: "closed_by_name",
      label: "Closed by",
      render: (r: CounterDay) => r.closed_by_name ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r: CounterDay) => (
        <Button size="xs" tone="tertiary" onClick={() => setPicked(r)}>
          {r.status === "closed" ? "View" : "Open day"}
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Each counter closes its business day once every drawer is cashed up: the cash is counted by
        denomination, any difference is explained, and nothing more can be dated to that day.
      </Text>
      <DataTable
        columns={columns}
        data={days.data ?? []}
        loading={days.isPending}
        rowKey={(r) => `${r.pharmacy_location_id}:${r.business_date}`}
        emptyTitle="No counter has opened a drawer in the last month"
      />
      <Drawer
        opened={Boolean(picked)}
        onClose={() => setPicked(null)}
        position="right"
        size="xl"
        title={picked ? `${picked.location_name ?? "Counter"} · ${picked.business_date}` : ""}
      >
        {picked && (
          <DayClosePanel
            locationId={picked.pharmacy_location_id}
            businessDate={picked.business_date}
            amountAccess={amountAccess}
          />
        )}
      </Drawer>
    </Stack>
  );
}
