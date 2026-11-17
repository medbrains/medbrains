/**
 * The sidebar menu as data, for the role test cases (#4804): the real
 * NAV_GROUPS — computed permission lists resolved — with English labels.
 * Read by scripts/generate_role_test_cases.py and the role-access journey,
 * so neither re-implements the menu.
 *
 *   npx vite-node --root apps/web apps/web/scripts/export-nav.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BRICK_NAMES } from "@medbrains/types";
import labels from "../public/locales/en/nav.json";
import { NAV_GROUPS, type NavItemConfig } from "../src/config/navigation";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../docs/testing/nav-menu.json");
const text = labels as Record<string, string>;

/** A group's English heading: the brick's name when the group is a brick, else its nav.json label. */
const groupLabel = (key: string) =>
  BRICK_NAMES[key] ?? text[`group${key[0].toUpperCase()}${key.slice(1)}`] ?? key;

const entry = (group: string, item: NavItemConfig, parent: string | null) => ({
  group,
  label: text[item.i18nKey] ?? item.i18nKey,
  path: item.path,
  one: item.requiredPermission ?? null,
  any: [...(item.requiredPermissions ?? [])],
  module: item.moduleCode ?? null,
  // A child sits under a parent entry (e.g. Administration → Admin → Users)
  // that is not itself a screen: the sidebar shows the parent when any child
  // is visible, and the children once it is opened.
  parent,
});

const menu = NAV_GROUPS.flatMap((group) =>
  group.items.flatMap((item) =>
    item.children?.length
      ? item.children.map((child) => entry(groupLabel(group.key), child, text[item.i18nKey] ?? item.i18nKey))
      : [entry(groupLabel(group.key), item, null)],
  ),
);

writeFileSync(out, `${JSON.stringify(menu, null, 2)}\n`);
console.log(`${menu.length} menu items -> docs/testing/nav-menu.json`);
