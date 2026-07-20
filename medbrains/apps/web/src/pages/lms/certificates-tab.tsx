// Lms CertificatesTab — split from lms.tsx (pure move).

import { Text } from "@mantine/core";
import type { LmsCertificate } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { lmsService } from "@/services/lms.service";
import { EmptyState } from "./empty-state";

export function CertificatesTab() {
  const { data: certs = [], isLoading } = useQuery<LmsCertificate[]>({
    queryKey: ["lms-my-certificates"],
    queryFn: () => lmsService.listMyCertificates(),
  });

  if (isLoading) return <EmptyState message="Loading certificates..." />;
  if (certs.length === 0) return <EmptyState message="No certificates issued yet." />;

  return (
    <DataTable
      columns={[
        {
          key: "certificate_no",
          label: "Certificate No.",
          render: (c: LmsCertificate) => (
            <Text size="sm" ff="monospace">
              {c.certificate_no}
            </Text>
          ),
        },
        {
          key: "course",
          label: "Course / Path",
          render: (c: LmsCertificate) => c.course_id ?? c.path_id ?? "\u2014",
        },
        {
          key: "issued",
          label: "Issued Date",
          render: (c: LmsCertificate) => new Date(c.issued_at).toLocaleDateString(),
        },
        {
          key: "expiry",
          label: "Expiry",
          render: (c: LmsCertificate) =>
            c.expires_at ? (
              <Text size="sm" c={new Date(c.expires_at) < new Date() ? "red" : undefined}>
                {new Date(c.expires_at).toLocaleDateString()}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                No expiry
              </Text>
            ),
        },
      ]}
      data={certs}
      rowKey={(c) => c.id}
    />
  );
}

// ── Main Page ──────────────────────────────────────────
