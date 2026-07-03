import { Code, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconCopy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Button, Card, IconButton, Input, Modal, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";

type Device = Awaited<ReturnType<typeof api.getVpnStatus>>[number];
type EnrollResult = Awaited<ReturnType<typeof api.enrollVpn>>;

/** Self-service VPN device enrollment (RFC-VPN-PLATFORM, P2). */
export function RemoteAccessPage() {
  useRequirePermission(P.VPN.ENROLL);
  const qc = useQueryClient();
  const [deviceName, setDeviceName] = useState("");
  const [enrolled, setEnrolled] = useState<EnrollResult | null>(null);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["vpn-devices"],
    queryFn: () => api.getVpnStatus(),
  });

  const enrollMut = useMutation({
    mutationFn: () => api.enrollVpn(deviceName.trim()),
    onSuccess: (res) => {
      setEnrolled(res);
      setDeviceName("");
      void qc.invalidateQueries({ queryKey: ["vpn-devices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Enrollment failed"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => api.revokeVpnDevice(id),
    onSuccess: () => {
      toast.success("Device revoked");
      void qc.invalidateQueries({ queryKey: ["vpn-devices"] });
    },
    onError: () => toast.error("Could not revoke device"),
  });

  const command = enrolled
    ? `tailscale up --login-server ${enrolled.login_server} --authkey ${enrolled.auth_key}`
    : "";

  const columns: Column<Device>[] = [
    { key: "name", label: "Device", render: (d) => d.name },
    {
      key: "created_at",
      label: "Enrolled",
      render: (d) => new Date(d.created_at).toLocaleString(),
    },
    {
      key: "status",
      label: "Status",
      render: (d) =>
        d.revoked_at ? (
          <Badge tone="danger" size="sm">
            Revoked
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            Active
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (d) =>
        d.revoked_at ? null : (
          <Button
            tone="danger"
            size="xs"
            onClick={() =>
              confirmDestructive({
                title: "Revoke device",
                message: `Revoke remote access for "${d.name}"? It cannot reconnect.`,
                confirmLabel: "Revoke",
                onConfirm: () => revokeMut.mutate(d.id),
              })
            }
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Remote Access (VPN)"
        description="Enroll a device to reach the HIMS securely from outside the hospital network."
      />
      <Card>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Enrolling gives you a one-time key to connect this device to the hospital VPN.
          </Text>
          <Group align="flex-end" gap="sm" wrap="nowrap">
            <Input
              label="Device name"
              placeholder="e.g. Dr. Rao's laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.currentTarget.value)}
            />
            <Button
              onClick={() => enrollMut.mutate()}
              loading={enrollMut.isPending}
              disabled={!deviceName.trim()}
            >
              Enroll device
            </Button>
          </Group>
        </Stack>
      </Card>

      <DataTable columns={columns} data={devices} loading={isLoading} rowKey={(d) => d.id} />

      <Modal opened={enrolled !== null} onClose={() => setEnrolled(null)} title="Device enrolled">
        {enrolled && (
          <Stack gap="sm">
            <Alert tone="warning" title="Copy this now — shown once">
              Run this on the device to connect:
            </Alert>
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <Code block style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {command}
              </Code>
              <IconButton
                tone="default"
                aria-label="Copy command"
                onClick={() => {
                  void navigator.clipboard.writeText(command);
                  toast.success("Copied");
                }}
              >
                <IconCopy size={16} />
              </IconButton>
            </Group>
            <Text size="xs" c="dimmed">
              Key expires {new Date(enrolled.expires_at).toLocaleString()}.
            </Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
