import { api } from "@medbrains/api";
import type { ModuleToken } from "@medbrains/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge, type BadgeTone, TokenDashboard, type TokenItem } from "@/components/ui";

const STATUS_TONE: Record<string, BadgeTone> = {
  waiting: "neutral",
  called: "warning",
  serving: "info",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  called: "Called",
  serving: "In progress",
};

function toItem(token: ModuleToken): TokenItem {
  return {
    id: token.id,
    tokenNumber: token.number,
    status: STATUS_LABEL[token.status] ?? token.status,
    tone: STATUS_TONE[token.status] ?? "neutral",
    primary: token.counter_label ?? token.scope_label ?? token.patient_name ?? undefined,
    meta: token.priority !== "normal" ? token.priority : undefined,
    active: token.status === "called" || token.status === "serving",
  };
}

export interface TokenBoardLiveProps {
  title: string;
  module: string;
  scope?: string;
  scopeId?: string;
}

/**
 * Live token board — polls the board endpoint (baseline) and subscribes to the
 * queue WebSocket for instant refresh on any token transition for this scope.
 * Maps ModuleToken[] into the presentational TokenDashboard. Usable on web /
 * mobile / TV; for a TV display, drop it on a full-screen route.
 */
export function TokenBoardLive({ title, module, scope, scopeId }: TokenBoardLiveProps) {
  const queryClient = useQueryClient();
  const queryKey = ["token-board", module, scope, scopeId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.listTokenBoard({ module, scope, scope_id: scopeId }),
    refetchInterval: 8000,
  });

  // Instant refresh on any token event for this scope (external WS system).
  useEffect(() => {
    if (!scopeId) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/queue/${scopeId}`);
    ws.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey });
    };
    return () => ws.close();
    // queryKey is derived from the deps below; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, module, scope, queryClient]);

  const tokens = (data ?? []).map(toItem);
  return (
    <TokenDashboard
      title={title}
      tokens={tokens}
      headerRight={<Badge tone="success">Live</Badge>}
    />
  );
}
