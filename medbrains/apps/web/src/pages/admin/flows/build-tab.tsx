/**
 * Admin → Flows → a flow → Build (RFC §11): only for flow designers
 * (`flows.build`); without it nothing is fetched. Loading, error with
 * retry (never shown as "checks pass"), then the builder.
 */
import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button } from "@/components/ui";
import { sopFlowsService } from "@/services/sopFlows.service";
import { TrackBuilder } from "./track-builder";
import { builderKey } from "./use-autosave";

export interface BuildTabProps {
  code: string;
  pendingTitle: string | null;
}

export function BuildTab({ code, pendingTitle }: BuildTabProps) {
  const canBuild = useHasPermission(P.FLOWS.BUILD);
  const view = useQuery({
    queryKey: builderKey(code),
    queryFn: () => sopFlowsService.builder(code),
    // No permission, no request.
    enabled: canBuild,
    // Autosave writes the server's answer here; never refetch over a draft.
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (!canBuild) {
    return (
      <Alert tone="info" title="Building tracks needs the flow designer permission">
        Ask a quality officer or the medical superintendent.
      </Alert>
    );
  }
  if (view.isLoading) return <Loader aria-label="Loading the track builder" />;
  if (view.error || !view.data) {
    return (
      <Alert tone="danger" title="Could not load the track builder">
        <Stack gap="xs">
          <Text size="sm">{view.error?.message ?? "No answer from the server"}</Text>
          <Group>
            <Button tone="secondary" size="xs" onClick={() => void view.refetch()}>
              Try again
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }
  return <TrackBuilder key={view.data.template_id} view={view.data} pendingTitle={pendingTitle} />;
}
