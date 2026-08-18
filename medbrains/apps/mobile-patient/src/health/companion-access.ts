/**
 * Whether the companion is open to this person.
 *
 * The companion ships **hidden**. It becomes visible one of three ways, and
 * they are independent because they answer to different owners:
 *
 *   1. the hospital licensed it        — management's decision, per tenant
 *   2. a band is paired to this person — they were given hardware
 *   3. they bought it                  — a self-serve user with no hospital
 *
 * Hidden is the default and the fallback. Every unknown resolves to hidden,
 * including a fault: a companion that fails *open* would appear for a whole
 * tenant that never licensed it, and a feature nobody agreed to sell is worse
 * than a feature that is briefly missing.
 *
 * Note this is the opposite default to `require_module_enabled` on the server,
 * which fails open on purpose — an absent `module_config` row there means
 * *enabled*, so that a transient database fault never takes a live clinical
 * module offline. That is right for a module a hospital is already using and
 * wrong for one it has not bought. Making the companion hidden therefore needs
 * an explicit `disabled` row seeded per tenant; silence is not enough.
 */

/** What we know about the three doors. Each is independently unknown-able. */
export interface CompanionEntitlement {
  /** The tenant's `module_config` says `enabled`. `undefined` while unknown. */
  readonly licensedByHospital?: boolean;
  /** A band is paired to this person. `undefined` while unknown. */
  readonly bandPaired?: boolean;
  /** A store purchase is active. `undefined` while unknown. */
  readonly purchased?: boolean;
}

export type CompanionAccess =
  /** Show it. */
  | { readonly state: "open"; readonly via: "hospital" | "band" | "purchase" }
  /** Do not show it, and say nothing about why. */
  | { readonly state: "hidden" };

export const HIDDEN: CompanionAccess = { state: "hidden" };

/**
 * Pure decision, so the rule is testable without a device, a tenant or a store.
 *
 * Order matters only for what `via` reports, not for whether it opens — it is
 * an OR. Hospital first because that is the answer a support call needs: "your
 * hospital turned it on" is a different conversation from "you bought it".
 */
export function resolveCompanionAccess(entitlement: CompanionEntitlement): CompanionAccess {
  if (entitlement.licensedByHospital === true) {
    return { state: "open", via: "hospital" };
  }
  if (entitlement.bandPaired === true) {
    return { state: "open", via: "band" };
  }
  if (entitlement.purchased === true) {
    return { state: "open", via: "purchase" };
  }
  return HIDDEN;
}

export function isOpen(access: CompanionAccess): boolean {
  return access.state === "open";
}
