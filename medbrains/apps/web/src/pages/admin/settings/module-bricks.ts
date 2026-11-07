import type { ModuleConfig } from "@medbrains/types";

/**
 * The core bricks the server switches off as a whole — screens and API — when the tenant turns
 * them off (`gated(...)` in `crates/medbrains-server/src/routes/mod.rs`).
 */
export const CORE_BRICKS: ReadonlySet<string> = new Set([
  "registration",
  "billing",
  "opd",
  "ipd",
  "lab",
  "pharmacy",
  "nursing",
  "hr",
  "inventory",
  "reports",
]);

/** Whether a brick is switched on. */
export function isOn(mod: ModuleConfig): boolean {
  return mod.status === "enabled";
}

/** The bricks that list `code` among what they need, directly. */
export function neededBy(code: string, modules: readonly ModuleConfig[]): ModuleConfig[] {
  return modules.filter((m) => m.depends_on.includes(code));
}

/**
 * Bricks that are on and need `code`, directly or through another brick — what switching it off
 * would break. Bounded: each brick is visited once.
 */
export function onDependents(code: string, modules: readonly ModuleConfig[]): ModuleConfig[] {
  const seen = new Set<string>([code]);
  const queue = [code];
  const found: ModuleConfig[] = [];
  for (let at = 0; at < queue.length; at++) {
    for (const dependent of neededBy(queue[at] ?? "", modules)) {
      if (seen.has(dependent.code)) continue;
      seen.add(dependent.code);
      queue.push(dependent.code);
      if (isOn(dependent)) found.push(dependent);
    }
  }
  return found;
}

/**
 * Bricks that `code` needs, directly or through another, that are off — in the order to switch
 * them on (what they need first). Bounded: each brick is visited once.
 */
export function offDependencies(code: string, modules: readonly ModuleConfig[]): ModuleConfig[] {
  const byCode = new Map(modules.map((m) => [m.code, m]));
  const seen = new Set<string>();
  const order: ModuleConfig[] = [];
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const mod = byCode.get(id);
    if (!mod) return;
    for (const dep of mod.depends_on) visit(dep);
    if (id !== code && !isOn(mod)) order.push(mod);
  };
  visit(code);
  return order;
}

/** Display names, joined for a sentence: "Pharmacy, Lab". */
export function names(mods: readonly ModuleConfig[]): string {
  return mods.map((m) => m.name).join(", ");
}
