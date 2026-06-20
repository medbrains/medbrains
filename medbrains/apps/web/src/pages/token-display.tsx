import { useSearchParams } from "react-router";
import { TokenBoardLive } from "@/components/TokenBoardLive";
import styles from "./token-display.module.scss";

const MODULE_TITLE: Record<string, string> = {
  registration: "Registration",
  opd: "OPD Queue",
  pharmacy: "Pharmacy",
  billing: "Billing",
  lab: "Laboratory",
  radiology: "Radiology",
  dispatch: "Dispatch",
};

/**
 * Full-screen, chrome-less, token-number-only board for a TV / waiting-area
 * display. Open `/token-display?module=opd&scope_id=<dept>&title=...`. No app
 * shell, no PHI — token number + room/counter only, with voice call-outs.
 */
export function TokenDisplayPage() {
  const [params] = useSearchParams();
  const module = params.get("module") ?? "opd";
  const scopeId = params.get("scope_id") ?? undefined;
  const scope = scopeId ? "department" : undefined;
  const title = params.get("title") ?? MODULE_TITLE[module] ?? "Queue";

  return (
    <div className={styles.display}>
      <TokenBoardLive title={title} module={module} scope={scope} scopeId={scopeId} publicMode />
    </div>
  );
}
