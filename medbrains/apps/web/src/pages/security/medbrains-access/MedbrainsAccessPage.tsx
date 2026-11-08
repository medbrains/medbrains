/**
 * Security → MedBrains access. The hospital decides when MedBrains support or
 * engineering staff may reach its data: it gives scoped, time-limited access,
 * a second person approves anything unmasked, every request made under it is
 * listed here, and access can be ended at once.
 */
import { Box, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P, type VendorAccessGrant } from "@medbrains/types";
import { IconShieldLock } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Alert, Badge, Button, Modal, TextArea, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { canEnd, moduleLabel, statusView, timeLeft } from "./access-view";
import { GrantEvents } from "./grant-events";
import { GrantForm } from "./grant-form";

const PER_PAGE = 50;
const GRANTS_KEY = ["vendor-access-grants"];

/** Who it is for and why. */
function WhoCell({ grant }: { grant: VendorAccessGrant }) {
  return (
    <Stack gap={0}>
      <Text size="sm" fw={600}>
        {grant.grantee_name ?? grant.grantee_email}
      </Text>
      <Text size="xs" c="dimmed">
        {grant.grantee_email}
      </Text>
      <Text size="xs">{grant.reason}</Text>
    </Stack>
  );
}

/** State, and how long is left on open access. */
function StatusCell({ grant }: { grant: VendorAccessGrant }) {
  const view = statusView(grant.status);
  const left = grant.status === "active" ? timeLeft(grant.expires_at) : null;
  return (
    <Stack gap={4}>
      <Badge tone={view.tone}>{view.label}</Badge>
      {left && <Text size="xs">{left}</Text>}
      <Badge tone={grant.is_masked ? "neutral" : "warning"}>
        {grant.is_masked ? "Patient data masked" : "Patient data unmasked"}
      </Badge>
    </Stack>
  );
}

/** Who gave, approved and ended it. */
function PeopleCell({ grant }: { grant: VendorAccessGrant }) {
  return (
    <Stack gap={0}>
      <Text size="xs">Given by {grant.created_by_name ?? "unknown"}</Text>
      {grant.approved_by_name && <Text size="xs">Approved by {grant.approved_by_name}</Text>}
      {grant.revoked_by_name && <Text size="xs">Ended by {grant.revoked_by_name}</Text>}
    </Stack>
  );
}

/** The MedBrains access screen. */
export function MedbrainsAccessPage() {
  useRequirePermission(P.SECURITY.VENDOR_ACCESS_VIEW);
  const canView = useHasPermission(P.SECURITY.VENDOR_ACCESS_VIEW);
  const canGrant = useHasPermission(P.SECURITY.VENDOR_ACCESS_GRANT);
  const canApprove = useHasPermission(P.SECURITY.VENDOR_ACCESS_APPROVE_UNMASKED);
  const canRevoke = useHasPermission(P.SECURITY.VENDOR_ACCESS_REVOKE);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [giving, setGiving] = useState(false);
  const [ending, setEnding] = useState<VendorAccessGrant | null>(null);
  const [endReason, setEndReason] = useState("");
  const [watching, setWatching] = useState<VendorAccessGrant | null>(null);

  const grants = useQuery({
    queryKey: [...GRANTS_KEY, page],
    queryFn: () => api.listVendorAccessGrants(page),
    enabled: canView,
  });
  /** Reload the grants list after any change. */
  const refresh = () => void qc.invalidateQueries({ queryKey: GRANTS_KEY });
  const create = useMutation({
    mutationFn: api.createVendorAccessGrant,
    onSuccess: (g) => {
      setGiving(false);
      refresh();
      toast.success(
        g.is_masked ? "Access given" : "Access asked for — waiting for a second approver",
      );
    },
  });
  const approve = useMutation({
    mutationFn: api.approveVendorAccessGrant,
    onSuccess: () => {
      refresh();
      toast.success("Unmasked access approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (g: VendorAccessGrant) => api.revokeVendorAccessGrant(g.id, endReason || undefined),
    onSuccess: () => {
      setEnding(null);
      setEndReason("");
      refresh();
      toast.success("Access ended. Their next request is refused.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = grants.data?.meta.total ?? 0;
  /** The row buttons a grant offers to this viewer, gated on what the server checks. */
  const actions = (g: VendorAccessGrant) => (
    <Group gap="xs" wrap="nowrap">
      <Button tone="tertiary" size="compact-sm" onClick={() => setWatching(g)}>
        {`Actions (${g.event_count})`}
      </Button>
      {canApprove && g.status === "pending_approval" && (
        <Button
          tone="primary"
          size="compact-sm"
          loading={approve.isPending && approve.variables === g.id}
          onClick={() => approve.mutate(g.id)}
        >
          Approve unmasked
        </Button>
      )}
      {canRevoke && canEnd(g) && (
        <Button tone="danger" size="compact-sm" onClick={() => setEnding(g)}>
          End access
        </Button>
      )}
    </Group>
  );

  return (
    <Box>
      <PageHeader
        title="MedBrains access"
        subtitle="When MedBrains support may reach this hospital's data, and everything they did"
        icon={<IconShieldLock size={28} aria-hidden="true" />}
        actions={
          canGrant ? (
            <Button tone="primary" onClick={() => setGiving(true)}>
              Give access
            </Button>
          ) : undefined
        }
      />
      <Stack gap="md">
        <Alert tone="info" title="Off unless you turn it on">
          MedBrains staff cannot open this hospital's records without access given here — whatever
          their account's role. Access is limited to the modules you choose, ends by itself, and
          every request is recorded.
        </Alert>
        <DataTable
          data={grants.data?.data ?? []}
          loading={grants.isLoading}
          error={grants.error}
          onRetry={() => void grants.refetch()}
          rowKey={(g) => g.id}
          rowTestId={(g) => `vendor-grant-${g.id}`}
          caption="MedBrains access grants"
          emptyTitle="MedBrains has no access"
          emptyDescription="Nothing has been given. Give access only for a named support task."
          total={total}
          page={page}
          perPage={PER_PAGE}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          onPageChange={setPage}
          columns={[
            { key: "who", label: "MedBrains person", render: (g) => <WhoCell grant={g} /> },
            {
              key: "scope",
              label: "May reach",
              render: (g) => <Text size="sm">{g.scope.map(moduleLabel).join(", ")}</Text>,
            },
            { key: "status", label: "State", render: (g) => <StatusCell grant={g} /> },
            { key: "people", label: "Hospital side", render: (g) => <PeopleCell grant={g} /> },
            { key: "actions", label: "", render: actions },
          ]}
        />
      </Stack>

      <Modal
        opened={giving}
        onClose={() => setGiving(false)}
        title="Give MedBrains access"
        size="md"
      >
        {giving && (
          <GrantForm
            saving={create.isPending}
            error={create.error}
            onSave={(v) => create.mutate(v)}
          />
        )}
      </Modal>

      <Modal
        opened={ending !== null}
        onClose={() => setEnding(null)}
        title="End MedBrains access"
        size="sm"
        danger
        primaryAction={
          ending
            ? {
                label: "End access now",
                onClick: () => revoke.mutate(ending),
                loading: revoke.isPending,
              }
            : undefined
        }
        secondaryAction={{ label: "Cancel", onClick: () => setEnding(null) }}
      >
        <Stack gap="sm">
          <Text size="sm">
            {ending?.grantee_email} loses access at once. Their next request is refused.
          </Text>
          <TextArea
            label="Reason (optional)"
            value={endReason}
            onChange={(e) => setEndReason(e.currentTarget.value)}
          />
        </Stack>
      </Modal>

      <Modal
        opened={watching !== null}
        onClose={() => setWatching(null)}
        title={watching ? `What ${watching.grantee_email} did` : ""}
        fullScreen
      >
        {watching && <GrantEvents grantId={watching.id} />}
      </Modal>
    </Box>
  );
}
