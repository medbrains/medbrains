import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconCloudDownload, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Alert, Button, toast } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { NhcxManualPayerModal } from "./NhcxManualPayerModal";
import { DIRECTORY_COLUMNS } from "./nhcxDirectoryColumns";
import { lastSynced } from "./nhcxSummary";

/** NHCX payer directory — the payers/TPAs (HCX participant codes) a claim can be
 * sent to, filled from the NHCX registry; a payer typed in by hand is the
 * fallback, with the certificate each message to it is encrypted with. */
export function NhcxPayerDirectory() {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canConfigure = useHasPermission(P.INSURANCE.NHCX.CONFIGURE);
  const canRefresh = useHasPermission(P.INSURANCE.NHCX.REFRESH_DIRECTORY);
  const [opened, { open, close }] = useDisclosure(false);

  const {
    data: participants = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
    enabled: canView,
  });

  const refresh = useMutation({
    mutationFn: () => api.refreshNhcxParticipants(),
    onSuccess: (r) => {
      queryClient.setQueryData(["nhcx-participants"], r.directory);
      const partial = r.failed.length ? ` ${r.failed.length} list(s) did not answer.` : "";
      toast.success(`${r.listed} payers and TPAs listed by NHCX.${partial}`, {
        title: "Directory refreshed",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Directory not refreshed" }),
  });

  if (!canView) return null;
  const synced = lastSynced(participants);

  return (
    <Stack gap="sm" mt="lg">
      <Group justify="space-between">
        <Stack gap={0}>
          <Text fw={600}>NHCX payer directory</Text>
          <Text size="xs" c="dimmed">
            {synced ? `Listed by NHCX ${formatDateTime(synced)}` : "Not yet listed by NHCX"}
          </Text>
        </Stack>
        <Group gap="xs">
          {canRefresh && (
            <Button
              tone="secondary"
              leftSection={<IconCloudDownload size={16} />}
              loading={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              Refresh from NHCX
            </Button>
          )}
          {canConfigure && (
            <Button tone="tertiary" leftSection={<IconPlus size={16} />} onClick={open}>
              Add payer by hand
            </Button>
          )}
        </Group>
      </Group>
      {isError ? (
        <Alert tone="warning" title="Could not load the NHCX payer directory">
          The payers are unknown right now — this does not mean there are none.
        </Alert>
      ) : (
        <DataTable
          columns={DIRECTORY_COLUMNS}
          data={participants}
          loading={isLoading}
          rowKey={(p) => p.id}
          emptyTitle="No payers yet — refresh the directory from NHCX."
        />
      )}

      <NhcxManualPayerModal opened={opened} onClose={close} />
    </Stack>
  );
}
