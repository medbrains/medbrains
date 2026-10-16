import type { LiveStewardshipRequest } from "@medbrains/types";
import type { FormularyDrug } from "./rxModel";

/**
 * Whether a live stewardship request already covers this Reserve antibiotic —
 * the server's rule: the request names the drug, its brand, or contains its
 * active ingredient. Covered drugs need no new indication.
 */
export function stewardshipCovers(
  drug: Pick<FormularyDrug, "name" | "salt">,
  requests: readonly LiveStewardshipRequest[],
): boolean {
  const name = drug.name.trim().toLowerCase();
  const salt = drug.salt.trim().toLowerCase();
  return requests.some((r) => {
    const requested = r.antibiotic_name.trim().toLowerCase();
    return requested === name || requested === salt || (salt !== "" && requested.includes(salt));
  });
}
