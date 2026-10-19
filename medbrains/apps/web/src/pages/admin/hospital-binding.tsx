import { Grid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DeviceBindingCode, type IssuedDeviceBindingCode, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { BindingQrSheet } from "@/components/Devices/BindingQrSheet";
import { IssueBindingForm } from "@/components/Devices/IssueBindingForm";
import { Alert, Badge, type BadgeTone, Button, Card, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { BINDING_STATUS_LABEL, type BindingStatus, bindingStatus } from "@/lib/binding-code";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { adminDevicesService } from "@/services/adminDevices.service";

const STATUS_TONE: Record<BindingStatus, BadgeTone> = {
  active: "success",
  used_up: "neutral",
  expired: "neutral",
  revoked: "danger",
};

/**
 * Hospital binding: a signed QR a staff or patient app scans to bind itself
 * to this hospital's server, pinned to its TLS key — nobody types a hospital
 * code or server address. Issue, print, and revoke codes here; the devices
 * they bound are under Paired devices.
 */
export function HospitalBindingPage() {
  useRequirePermission(P.DEVICES.BINDING.LIST);
  const canIssue = useHasPermission(P.DEVICES.BINDING.ISSUE);
  const canRevoke = useHasPermission(P.DEVICES.BINDING.REVOKE);
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssuedDeviceBindingCode | null>(null);

  const codes = useQuery({
    queryKey: ["device-binding-codes"],
    queryFn: () => adminDevicesService.listDeviceBindingCodes(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["device-binding-codes"] });

  const issue = useMutation({
    mutationFn: adminDevicesService.issueDeviceBindingCode,
    onSuccess: (code) => {
      setIssued(code);
      void refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminDevicesService.revokeDeviceBindingCode(id),
    onSuccess: () => void refresh(),
  });

  return (
    <>
      <PageHeader
        title="Hospital binding"
        subtitle="Print a signed QR that binds the MedBrains staff or patient app to this hospital."
      />
      <Grid>
        {canIssue && (
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card>
              <Stack gap="sm">
                <Text fw={600}>New binding QR</Text>
                {issue.isError && <Alert tone="danger">{issue.error.message}</Alert>}
                <IssueBindingForm submitting={issue.isPending} onSubmit={issue.mutate} />
              </Stack>
            </Card>
          </Grid.Col>
        )}
        <Grid.Col span={{ base: 12, md: canIssue ? 8 : 12 }}>
          <CodesTable
            codes={codes.data}
            loading={codes.isPending}
            error={codes.isError ? codes.error.message : null}
            canRevoke={canRevoke}
            onRevoke={(code) =>
              confirmDestructive({
                title: `Revoke “${code.label}”?`,
                message:
                  "The QR stops binding devices at once. Devices it already bound keep working until you revoke them under Paired devices.",
                confirmLabel: "Revoke code",
                onConfirm: () => revoke.mutate(code.id),
              })
            }
          />
          {revoke.isError && <Alert tone="danger">{revoke.error.message}</Alert>}
        </Grid.Col>
      </Grid>
      <BindingQrSheet code={issued} onClose={() => setIssued(null)} />
    </>
  );
}

interface CodesTableProps {
  codes: DeviceBindingCode[] | undefined;
  loading: boolean;
  error: string | null;
  canRevoke: boolean;
  onRevoke: (code: DeviceBindingCode) => void;
}

function CodesTable({ codes, loading, error, canRevoke, onRevoke }: CodesTableProps) {
  // An outage must not read as "no codes issued".
  if (error) return <Alert tone="danger">Could not load binding codes: {error}</Alert>;
  if (loading) return <Text c="dimmed">Loading binding codes…</Text>;
  if (!codes?.length) return <Text c="dimmed">No binding codes issued yet.</Text>;
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Label</Table.Th>
          <Table.Th>Used</Table.Th>
          <Table.Th>Valid until</Table.Th>
          <Table.Th>Issued by</Table.Th>
          <Table.Th>Status</Table.Th>
          {canRevoke && <Table.Th aria-label="Actions" />}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {codes.map((code) => {
          const status = bindingStatus(code);
          return (
            <Table.Tr key={code.id}>
              <Table.Td>{code.label}</Table.Td>
              <Table.Td>
                {code.use_count} of {code.max_uses}
              </Table.Td>
              <Table.Td>{new Date(code.expires_at).toLocaleString()}</Table.Td>
              <Table.Td>{code.issued_by_name ?? "—"}</Table.Td>
              <Table.Td>
                <Badge tone={STATUS_TONE[status]}>{BINDING_STATUS_LABEL[status]}</Badge>
              </Table.Td>
              {canRevoke && (
                <Table.Td>
                  {status === "active" && (
                    <Button tone="danger-ghost" size="xs" onClick={() => onRevoke(code)}>
                      Revoke
                    </Button>
                  )}
                </Table.Td>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
