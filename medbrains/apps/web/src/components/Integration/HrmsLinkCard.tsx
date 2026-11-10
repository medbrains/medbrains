import { Group, Stack, Text } from "@mantine/core";
import { useHasAllPermissions, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Panel } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { hrmsService } from "@/services/hrms.service";
import { HrmsLinkForm } from "./HrmsLinkForm";
import { HrmsSyncTable } from "./HrmsSyncTable";

/**
 * The hospital's link to its HRMS (Humanex): connection settings, a pull on
 * demand, and how the last pull of each entity went. Humanex is the system of
 * record for the staff it sends; this card never edits staff.
 */
export function HrmsLinkCard() {
  const canView = useHasPermission(P.INTEGRATION.VIEW);
  const canEdit = useHasAllPermissions([P.INTEGRATION.UPDATE, P.ADMIN.USERS.LIST]);
  const canSync = useHasPermission(P.INTEGRATION.EXECUTE);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const config = useQuery({
    queryKey: ["hrms-humanex-config"],
    queryFn: () => hrmsService.getHumanexConfig(),
    enabled: canView,
  });
  const status = useQuery({
    queryKey: ["hrms-humanex-status"],
    queryFn: () => hrmsService.getHumanexStatus(),
    enabled: canView,
  });

  const sync = useMutation({
    mutationFn: () => hrmsService.syncHumanex(),
    onSuccess: (outcomes) => {
      const failed = outcomes.filter((o) => o.error || o.failed > 0).length;
      if (failed > 0) toast.warning(`${failed} feed(s) had problems. See the table below.`);
      else toast.success("Pulled from Humanex.");
      void queryClient.invalidateQueries({ queryKey: ["hrms-humanex-status"] });
    },
    onError: (err: Error) => toast.error(err.message, { title: "The pull did not run" }),
  });

  if (!canView) return null;
  const cfg = config.data;
  const isSetUp = Boolean(cfg?.base_url);

  return (
    <Panel
      title="HR system (Humanex)"
      description="Staff, departments, shifts, leave, rosters and attendance come from the hospital's HRMS. Edit them there."
      actions={
        <Group gap="xs">
          {isSetUp && (
            <Badge tone={cfg?.enabled ? "success" : "neutral"}>
              {cfg?.enabled ? "Pulling every 15 min" : "Paused"}
            </Badge>
          )}
          {canSync && isSetUp && (
            <Button
              size="sm"
              leftSection={<IconRefresh size={16} />}
              loading={sync.isPending}
              onClick={() => sync.mutate()}
            >
              Pull now
            </Button>
          )}
          {canEdit && cfg && (
            <Button size="sm" tone="tertiary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : isSetUp ? "Edit connection" : "Connect Humanex"}
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="md">
        {config.isError && (
          <Alert tone="danger" title="The HRMS settings could not be loaded">
            Whether Humanex is connected is unknown. Refresh to try again.
          </Alert>
        )}
        {config.isLoading && (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        )}
        {cfg && !isSetUp && !editing && (
          <Text size="sm" c="dimmed">
            Humanex is not connected. Staff are kept by hand in HR.
          </Text>
        )}
        {cfg && editing && <HrmsLinkForm config={cfg} onSaved={() => setEditing(false)} />}
        {isSetUp && (
          <HrmsSyncTable
            status={status.data}
            isLoading={status.isLoading}
            isError={status.isError}
          />
        )}
      </Stack>
    </Panel>
  );
}
