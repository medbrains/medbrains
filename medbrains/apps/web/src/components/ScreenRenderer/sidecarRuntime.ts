import { api } from "@medbrains/api";
import type { ResolvedSidecar } from "@medbrains/types";
import type { QueryClient } from "@tanstack/react-query";
import { evaluateCondition } from "./evaluateCondition";
import { executeInlineAction } from "./executeInlineAction";

export interface SidecarRuntimeContext {
  navigate: (path: string) => void;
  queryClient: QueryClient;
  screenData: Record<string, unknown>;
}

export async function executeResolvedSidecar(
  sidecar: ResolvedSidecar,
  context: SidecarRuntimeContext,
): Promise<void> {
  if (sidecar.pipeline_id) {
    try {
      await api.triggerPipeline(sidecar.pipeline_id, {
        input_data: context.screenData,
      });
    } catch {
      // Pipeline trigger failures are non-blocking
    }
    return;
  }

  if (sidecar.inline_action) {
    await executeInlineAction(sidecar.inline_action, context);
  }
}

export async function runResolvedSidecars(
  sidecars: ResolvedSidecar[],
  trigger: string,
  context: SidecarRuntimeContext,
): Promise<void> {
  const matchingSidecars = sidecars.filter((sidecar) => sidecar.trigger_event === trigger);

  for (const sidecar of matchingSidecars) {
    if (!evaluateCondition(sidecar.condition, context.screenData)) {
      continue;
    }

    await executeResolvedSidecar(sidecar, context);
  }
}
