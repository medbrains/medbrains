import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useLiveActivityStore } from "./live-activity-store";

/**
 * Emergency-code contributor to the Live Activity Island — a second, dramatic source
 * proving the plugin pattern. Polls active code activations and, while any is live,
 * pushes a top-priority, NON-dismissible code activity (a code stays until resolved).
 * Renders nothing itself; it only contributes to the island.
 */
export function EmergencyCodeActivity() {
  const navigate = useNavigate();
  const setActivity = useLiveActivityStore((s) => s.setActivity);
  // A role that may not list codes is refused; it does not poll (it did,
  // every 20 s, with a 403 each time).
  const canList = useHasPermission(P.EMERGENCY.CODES.LIST);

  const { data: codes = [] } = useQuery({
    queryKey: ["emergency-codes-active"],
    queryFn: () => api.listCodeActivations(),
    refetchInterval: 20_000,
    retry: false,
    enabled: canList,
  });
  const top = codes.find((c) => !c.deactivated_at);
  const topCode = top?.code_type ?? null;
  const topLoc = top?.location ?? null;

  useEffect(() => {
    if (!topCode) {
      setActivity("emergency-code", null);
      return;
    }
    const label = topCode.replace(/^code_/, "").replace(/\b\w/g, (m) => m.toUpperCase());
    setActivity("emergency-code", {
      priority: 110,
      tone: "code",
      kind: topCode,
      title: `Code ${label}`,
      message: topLoc ?? "Active",
      actions: [{ label: "Respond", primary: true, onClick: () => navigate("/emergency") }],
      dismissible: false,
    });
  }, [topCode, topLoc, setActivity, navigate]);

  return null;
}
