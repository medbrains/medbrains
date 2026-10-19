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
import labels from "../public/locales/en/nav.json";
import { NAV_GROUPS, type NavItemConfig } from "../src/config/navigation";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../docs/testing/nav-menu.json");
const text = labels as Record<string, string>;

const groupLabel = (key: string) => text[`group${key[0].toUpperCase()}${key.slice(1)}`] ?? key;

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
