/**
 * ABDM consent requests (HIU_FLOW_104): every request this hospital raised
 * as a Health Information User, newest first, filterable by status — with
 * each patient's ABHA number and address, the scope granted and the time of
 * each status. Limited to the patients the user may see.
 */
import { Group, Loader, Pagination, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { AbdmConsentRequestStatus } from "@medbrains/types";
import { P } from "@medbrains/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { CONSENT_REQUEST_STATUS } from "@/components/Patient/abdm/abdmStatus";
import { ConsentRequestTable } from "@/components/Patient/abdm/ConsentRequestTable";
import { Alert, Button, Card, Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { abdmRecordsService } from "@/services/abdmRecords.service";

/** The server's default page size (`pagination.rs`). */
const PAGE_SIZE = 50;

const STATUS_OPTIONS = Object.entries(CONSENT_REQUEST_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

/** The hospital-wide consent list; never fetched without `abdm.consent.list`. */
export default function AbdmConsentRequestsPage() {
  useRequirePermission(P.ABDM.CONSENT.LIST);
  const canList = useHasPermission(P.ABDM.CONSENT.LIST);
  const canCheck = useHasPermission(P.ABDM.CONSENT.REQUEST);
  const [status, setStatus] = useState<AbdmConsentRequestStatus | undefined>();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["abdm", "consent-requests", status ?? "all", page],
    queryFn: () => abdmRecordsService.consentRequests({ status, page }),
    enabled: canList,
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack gap="md">
      <PageHeader
        title="ABDM consent requests"
        subtitle="Records asked for from other hospitals, and where each request stands"
        actions={
          <Select
            aria-label="Status"
            placeholder="All statuses"
            data={STATUS_OPTIONS}
            value={status ?? null}
            onChange={(v) => {
              setStatus((v as AbdmConsentRequestStatus | null) ?? undefined);
              setPage(1);
            }}
            clearable
            w={240}
          />
        }
      />
      {query.isLoading && <Loader size="sm" aria-label="Loading consent requests" />}
      {query.isError && (
        <Alert tone="danger" title="Could not load the consent requests">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">The list failed to load — this does not mean there are none.</Text>
            <Button tone="secondary" size="xs" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </Stack>
        </Alert>
      )}
      {query.data && (
        <Card>
          <Stack gap="md">
            <ConsentRequestTable
              requests={query.data.data}
              canCheck={canCheck}
              showPatient
              emptyText={
                status
                  ? `No request is ${CONSENT_REQUEST_STATUS[status].label.toLowerCase()}.`
                  : "No consent request has been raised yet. Doctors raise them from a patient's chart."
              }
            />
            {pages > 1 && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {total} requests
                </Text>
                <Pagination
                  total={pages}
                  value={page}
                  onChange={setPage}
                  getControlProps={(control) => ({ "aria-label": `${control} page` })}
                />
              </Group>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
