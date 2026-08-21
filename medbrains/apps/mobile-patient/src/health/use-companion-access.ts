/**
 * Resolves whether the companion is open, starting from hidden.
 *
 * The initial state is `HIDDEN` and stays that way until an entitlement says
 * otherwise, so the Health tab cannot flash into view during the first render
 * for somebody whose hospital never licensed it. Hidden-by-default has to be
 * true of the *loading* state too, or it is not a default at all.
 *
 * The three lookups are stubs today and each one is a phase:
 *   · hospital  — `module_config` for the tenant, seeded `disabled` (next unit)
 *   · band      — a paired band (phase 4)
 *   · purchase  — a store entitlement (phase 2)
 */

import { useEffect, useState } from "react";
import { getPortalEntitlements } from "../api/portal.js";
import type { CompanionAccess } from "./companion-access.js";
import { HIDDEN, resolveCompanionAccess } from "./companion-access.js";

export function useCompanionAccess(): CompanionAccess {
  const [access, setAccess] = useState<CompanionAccess>(HIDDEN);

  useEffect(() => {
    let cancelled = false;

    /**
     * A rejected request leaves the door `undefined`, not `false`, and either
     * keeps the tab shut — the distinction matters for the other two doors,
     * which resolve independently and must not be closed by this one's failure.
     *
     * A patient with no hospital gets a rejection here every time. That is the
     * expected path for a self-serve user, not an error worth surfacing.
     */
    void getPortalEntitlements()
      .then((entitlements) => ({ licensedByHospital: entitlements.companion }))
      .catch(() => ({}))
      .then((entitlement) => {
        if (!cancelled) {
          setAccess(resolveCompanionAccess(entitlement));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}
