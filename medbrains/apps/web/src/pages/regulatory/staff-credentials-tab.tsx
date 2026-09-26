// REGULATORY StaffCredentialsTab — split from regulatory.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { StaffCredentialSummary } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

export function StaffCredentialsTab() {
  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["regulatory-staff-credentials"],
    queryFn: () => regulatoryService.staffCredentials(),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Staff Credentials"
        subtitle="Track professional credentials and expiry dates"
      />

      <DataTable
        data={credentials}
        rowKey={(r) => `${r.employee_id}-${r.credential_type}`}
        loading={isLoading}
        columns={[
          {
            key: "employee_name",
            label: "Staff Name",
            render: (r: StaffCredentialSummary) => (
              <Text size="sm" fw={500}>
                {r.employee_name ?? "Unnamed employee"}
              </Text>
            ),
          },
          {
            key: "credential_type",
            label: "Credential",
            render: (r: StaffCredentialSummary) => (
              <Badge tone="neutral">{r.credential_type.replaceAll("_", " ")}</Badge>
            ),
          },
          {
            key: "expiry_date",
            label: "Expiry Date",
            render: (r: StaffCredentialSummary) =>
              r.expiry_date ? (
                <Text size="sm">{r.expiry_date.slice(0, 10)}</Text>
              ) : (
                <Text size="sm" c="dimmed">
                  N/A
                </Text>
              ),
          },
          {
            key: "days_to_expiry",
            label: "Expiry",
            render: (r: StaffCredentialSummary) => {
              if (r.days_to_expiry == null)
                return (
                  <Text size="sm" c="dimmed">
                    N/A
                  </Text>
                );
              const color: BadgeTone =
                r.days_to_expiry < 0
                  ? "danger"
                  : r.days_to_expiry < 30
                    ? "danger"
                    : r.days_to_expiry < 90
                      ? "warning"
                      : "success";
              return (
                <Badge tone={color}>
                  {r.days_to_expiry < 0
                    ? `${Math.abs(r.days_to_expiry)}d expired`
                    : `${r.days_to_expiry}d`}
                </Badge>
              );
            },
          },
        ]}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  License Dashboard Tab
// ══════════════════════════════════════════════════════════
