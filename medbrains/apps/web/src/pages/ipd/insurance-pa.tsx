// IPD InsurancePaTab — the admission's eligibility and pre-authorisations,
// each with its NHCX exchange and IRDAI clock.

import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxPreauthSlaRow, PriorAuthRequestRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { NhcxEligibilityCard } from "@/components/Nhcx/NhcxEligibilityCard";
import { NhcxSlaBadge } from "@/components/Nhcx/NhcxSlaBadge";
import { PreauthNhcxDrawer } from "@/components/Nhcx/PreauthNhcxDrawer";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

const paStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "primary",
  in_review: "info",
  pending_info: "warning",
  approved: "success",
  partially_approved: "warning",
  denied: "danger",
  cancelled: "neutral",
  expired: "warning",
};

/** Inpatient care: medical, surgical, room and board. */
const IPD_CATEGORIES = ["1", "2", "49"];

export function InsurancePaTab({
  admissionId,
  patientId,
}: {
  admissionId: string;
  patientId: string;
}) {
  // The tab rides in on ipd.admissions.view; the pre-authorisations carries its own
  // code. Refused, `data ?? []` renders an empty table that reads as a
  // fact about the patient rather than about the reader.
  const canViewPriorAuth = useHasPermission(P.BILLING.CORPORATE_LIST);
  const canViewNhcx = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canSubmitNhcx = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const [open, setOpen] = useState<PriorAuthRequestRow | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ipd-prior-auth", admissionId],
    queryFn: () => ipdService.getAdmissionPriorAuth(admissionId),
    enabled: canViewPriorAuth,
  });
  const sla = useQuery({
    queryKey: ["nhcx-sla", patientId],
    queryFn: () => api.getNhcxSla(patientId),
    enabled: canViewNhcx && !!patientId,
  });
  const slaById = useMemo(
    () =>
      new Map<string, NhcxPreauthSlaRow>((sla.data?.rows ?? []).map((r) => [r.prior_auth_id, r])),
    [sla.data],
  );

  const rows = data ?? [];

  return (
    <Stack>
      <NhcxEligibilityCard
        patientId={patientId}
        triggerPoint="admission"
        triggerEntityId={admissionId}
        serviceCategories={IPD_CATEGORIES}
      />
      <Text fw={600}>Prior Authorization Requests</Text>
      {sla.isError && (
        <Alert tone="warning" title="Could not load the IRDAI clock">
          Whether a payer is over its time limit is unknown right now.
        </Alert>
      )}
      {!canViewPriorAuth ? null : isError ? (
        <Alert tone="warning" title="Could not load the pre-authorisations">
          Whether this admission has any is unknown right now — try again in a minute.
        </Alert>
      ) : isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PA Number</Table.Th>
              <Table.Th>Service</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Urgency</Table.Th>
              <Table.Th>Submitted</Table.Th>
              {canViewNhcx && <Table.Th>IRDAI clock</Table.Th>}
              {(canViewNhcx || canSubmitNhcx) && <Table.Th>NHCX</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((pa) => {
              const clock = slaById.get(pa.id);
              const breached = clock?.sla.state === "breached";
              return (
                <Table.Tr key={pa.id} bg={breached ? "var(--mb-danger-bg)" : undefined}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {pa.pa_number}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{pa.service_type}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={paStatusColors[pa.status] ?? "neutral"} size="sm">
                      {pa.status.replace(/_/g, " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{pa.urgency}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {pa.submitted_at ? new Date(pa.submitted_at).toLocaleString() : "—"}
                    </Text>
                  </Table.Td>
                  {canViewNhcx && (
                    <Table.Td>
                      {clock ? (
                        <NhcxSlaBadge sla={clock.sla} />
                      ) : (
                        <Text size="xs" c="dimmed">
                          {sla.isLoading ? "…" : "Not sent yet"}
                        </Text>
                      )}
                    </Table.Td>
                  )}
                  {(canViewNhcx || canSubmitNhcx) && (
                    <Table.Td>
                      <Button size="xs" tone="secondary" onClick={() => setOpen(pa)}>
                        {clock && clock.open_queries > 0
                          ? `Payer query (${clock.open_queries})`
                          : "Open"}
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No prior authorization requests for this admission.
        </Text>
      )}
      <PreauthNhcxDrawer
        priorAuthId={open?.id ?? null}
        paNumber={open?.pa_number ?? ""}
        onClose={() => setOpen(null)}
      />
    </Stack>
  );
}
