/**
 * Admin → Form friction. Which saves the server refused (400 and 422), ranked
 * by screen, with the most common reasons and the change against the period
 * before. Each one is a form that let a bad entry through — or a server rule
 * that may be wrong.
 *
 * Counts only: the server keeps no patient, no staff member and no typed
 * value, so none can be shown. A failed read is an error with a retry, never
 * "no refusals".
 */
import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components";
import { Alert, Button, Card, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { FrictionTable } from "./form-friction/friction-table";
import { PERIOD_OPTIONS } from "./form-friction/labels";

/** The form friction report, for `admin.form_friction.view`. */
export function FormFrictionPage() {
  useRequirePermission(P.ADMIN.FORM_FRICTION.VIEW);
  const canView = useHasPermission(P.ADMIN.FORM_FRICTION.VIEW);
  const [days, setDays] = useState("30");
  const report = useQuery({
    queryKey: ["admin", "form-friction", days],
    queryFn: () => api.getFormFriction(Number(days)),
    enabled: canView,
  });
  const data = report.data;

  return (
    <Stack gap="md">
      <PageHeader
        title="Form friction"
        subtitle="Saves the server refused, screen by screen — counted, never the person"
      />
      <Alert tone="info" title="What this shows">
        <Text size="sm">
          Each of these is a form that let a bad entry through: add the check on the form, or the
          server rule may be wrong. Reasons have every typed value removed.
        </Text>
      </Alert>
      <Group justify="space-between">
        <SegmentedControl
          aria-label="Period shown"
          value={days}
          onChange={setDays}
          data={PERIOD_OPTIONS}
        />
        {data && (
          <Text size="sm" data-testid="friction-totals">
            {data.total.toLocaleString("en-IN")} refused in the last {data.days} days;{" "}
            {data.previous_total.toLocaleString("en-IN")} in the {data.days} days before.
          </Text>
        )}
      </Group>
      {report.isLoading && (
        <Text size="sm" c="dimmed" data-testid="friction-loading">
          Loading refused saves…
        </Text>
      )}
      {report.isError && (
        <Alert tone="danger" title="Refused saves are unknown" data-testid="friction-error">
          <Group justify="space-between" align="center">
            <Text size="sm">
              The server did not answer, so this is not a count of zero. Try again shortly.
            </Text>
            <Button tone="secondary" onClick={() => void report.refetch()}>
              Try again
            </Button>
          </Group>
        </Alert>
      )}
      {data && data.routes.length === 0 && (
        <Card padding="md" withBorder data-testid="friction-empty">
          <EmptyState
            title={`No save was refused in the last ${data.days} days`}
            description="Counts are written once a minute, so a refusal shows here within about a minute."
          />
        </Card>
      )}
      {data && data.routes.length > 0 && (
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <FrictionTable routes={data.routes} />
            <Text size="xs" c="dimmed">
              Ranked by refusals in this period; up to five reasons each.
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
