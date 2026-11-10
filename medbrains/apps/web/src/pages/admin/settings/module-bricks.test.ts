// @vitest-environment node

import { useModuleStore } from "@medbrains/stores";
import type { ModuleConfig } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS, type NavItemConfig } from "@/config/navigation";
import { offDependencies, onDependents } from "./module-bricks";

function mod(code: string, status: "enabled" | "disabled", depends_on: string[] = []) {
  return { code, name: code, status, depends_on } as unknown as ModuleConfig;
}

const MODULES = [
  mod("registration", "enabled"),
  mod("pharmacy", "enabled", ["registration"]),
  mod("ipd", "disabled", ["registration"]),
  mod("ot", "disabled", ["registration", "ipd"]),
];

function leaves(items: NavItemConfig[]): NavItemConfig[] {
  return items.flatMap((item) => [item, ...leaves(item.children ?? [])]);
}

describe("module bricks", () => {
  it("names the bricks that are on and need the one being switched off", () => {
    expect(onDependents("registration", MODULES).map((m) => m.code)).toEqual(["pharmacy"]);
    expect(onDependents("pharmacy", MODULES)).toEqual([]);
  });

  it("offers what a brick needs, what they need first", () => {
    const all = MODULES.map((m) =>
      m.code === "registration" ? mod("registration", "disabled") : m,
    );
    expect(offDependencies("ot", all).map((m) => m.code)).toEqual(["registration", "ipd"]);
  });

  it("hides every Pharmacy menu entry when the pharmacy brick is off", () => {
    const pharmacy = leaves(NAV_GROUPS.flatMap((g) => g.items)).filter((i) =>
      i.path.startsWith("/pharmacy"),
    );
    expect(pharmacy.map((i) => i.i18nKey)).toContain("pharmacy");
    useModuleStore.getState().setDisabledModules(["pharmacy"]);
    const { isModuleEnabled } = useModuleStore.getState();
    expect(pharmacy.filter((i) => isModuleEnabled(i.moduleCode))).toEqual([]);
  });
});
