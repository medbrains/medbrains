/**
 * The counter keeps selling when yesterday was never counted — dispensing
 * must not stop for it — but the cashier sees it on every visit until the day
 * is closed. Shown only to someone who can read the day-close list.
 */
import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Alert, Button } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";

/** The local calendar date, as the server writes business dates. */
function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function UnclosedDayNotice({ locationId }: { locationId: string }) {
  const navigate = useNavigate();
  const canView = useHasPermission(P.PHARMACY.DAY_CLOSE_VIEW);
  const days = useQuery({
    queryKey: ["pharmacy-day-close", "list"],
    queryFn: () => pharmacyFinanceService.listCounterDays(),
    enabled: canView,
  });
  const today = todayIso();
  const unclosed = (days.data ?? [])
    .filter(
      (d) =>
        d.pharmacy_location_id === locationId && d.status !== "closed" && d.business_date < today,
    )
    .map((d) => d.business_date)
    .sort();
  if (unclosed.length === 0) return null;
  return (
    <Alert tone="warning" data-testid="unclosed-day">
      <Group justify="space-between">
        <Text size="sm">
          {unclosed.length === 1
            ? `The ${unclosed[0]} day at this counter has not been closed.`
            : `${unclosed.length} earlier days at this counter have not been closed, the first ${unclosed[0]}.`}
        </Text>
        <Button
          size="compact-sm"
          tone="secondary"
          onClick={() => navigate("/pharmacy/finance?tab=day-close")}
        >
          Close it
        </Button>
      </Group>
    </Alert>
  );
}
