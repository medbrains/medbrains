/**
 * Admin → Kernel. Whether the trusted core every module goes through is doing
 * its job (RFC-HOSPITAL-OS K1): the audit chain's last verdict, whether the
 * database enforces hospital separation, which authorisation engine answers,
 * how settings resolve, and which modules already go only through the kernel.
 *
 * A failed read is shown as unknown with a retry — never as healthy.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { kernelService } from "@/services/kernel.service";
import { FacadeTable } from "./kernel/facade-table";
import { HealthCard } from "./kernel/health-card";
import { auditChainStatus, authzStatus, configStatus, rlsStatus } from "./kernel/status";

export function KernelPage() {
  useRequirePermission(P.ADMIN.KERNEL.VIEW);
  const canView = useHasPermission(P.ADMIN.KERNEL.VIEW);
  const health = useQuery({
    queryKey: ["admin", "kernel"],
    queryFn: kernelService.getHealth,
    enabled: canView,
  });
  const refresh = (
    <Button
      tone="secondary"
      leftSection={<IconRefresh size={16} />}
      loading={health.isFetching}
      onClick={() => void health.refetch()}
    >
      Check again
    </Button>
  );

  return (
    <Stack gap="md">
      <PageHeader
        title="Kernel"
        subtitle="The trusted core every module goes through — and whether it is doing its job"
        actions={canView ? refresh : undefined}
      />
      {health.isLoading && (
        <Text size="sm" c="dimmed" data-testid="kernel-loading">
          Checking the kernel…
        </Text>
      )}
      {health.isError && (
        <Alert tone="danger" title="Kernel health is unknown" data-testid="kernel-error">
          <Group justify="space-between" align="center">
            <Text size="sm">
              The server did not answer, so nothing here can be confirmed. This is not a healthy
              result.
            </Text>
            {refresh}
          </Group>
        </Alert>
      )}
      {health.data && (
        <>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <HealthCard title="Audit chain" status={auditChainStatus(health.data.audit_chain)} />
            <HealthCard title="Hospital separation" status={rlsStatus(health.data.rls)} />
            <HealthCard
              title="Authorisation engine"
              status={authzStatus(health.data.authz_backend)}
            />
            <HealthCard
              title="Settings resolver"
              status={configStatus(health.data.config_scopes)}
            />
          </SimpleGrid>
          <FacadeTable crates={health.data.crates} />
        </>
      )}
    </Stack>
  );
}
