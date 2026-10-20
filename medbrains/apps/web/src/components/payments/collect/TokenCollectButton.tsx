import type { BillingLaneName, ModuleToken } from "@medbrains/types";
import { IconCash } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { useCollect } from "./collect-store";
import { useCanCollect } from "./use-dues";

/** The lane each token desk collects; the billing desk collects them all. */
const TOKEN_COLLECT_LANE: Record<string, BillingLaneName | undefined> = {
  billing: undefined,
  registration: "registration",
  opd: "opd",
  lab: "lab",
  radiology: "radiology",
  pharmacy: "pharmacy",
};

/** "Collect" for the patient at the counter: their token is called or being served. */
export function TokenCollectButton({ module, token }: { module: string; token: ModuleToken }) {
  const lane = TOKEN_COLLECT_LANE[module];
  const canCollect = useCanCollect(lane) && module in TOKEN_COLLECT_LANE;
  const open = useCollect((s) => s.open);
  const atCounter = token.status === "called" || token.status === "serving";
  if (!canCollect || !token.patient_id || !atCounter) return null;
  return (
    <Button
      tone="primary"
      size="xs"
      leftSection={<IconCash size={14} />}
      data-testid="btn-token-collect"
      onClick={() => open({ patientId: token.patient_id ?? null, lane })}
    >
      Collect
    </Button>
  );
}
