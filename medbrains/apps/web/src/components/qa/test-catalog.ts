/**
 * A role's test cases (#4804), computed from the code exactly as
 * scripts/generate_role_test_cases.py writes them to the workbook: same ids,
 * same rules, same words. Results are stored against these ids.
 */
import type { TFunction } from "i18next";
import { NAV_GROUPS, type NavItemConfig } from "@/config/navigation";
import workflows from "@/data/role-workflows.json";

export type CaseType = "Sign in" | "Should see" | "Must not see" | "Workflow";

export interface TestCase {
  id: string;
  type: CaseType;
  area: string;
  title: string;
  steps: string;
  expected: string;
  /** The screen the case is about, for "this screen". */
  path?: string;
}

interface MenuEntry {
  group: string;
  parent: string | null;
  label: string;
  item: NavItemConfig;
}

/** The screens a leak would hurt most, probed by address when not allowed. */
const SENSITIVE = [
  "/admin/users",
  "/audit",
  "/billing",
  "/mrd",
  "/pharmacy",
  "/lab",
  "/ipd",
  "/hr/payroll",
];

const groupKey = (key: string) => `group${key.charAt(0).toUpperCase()}${key.slice(1)}`;

function menu(t: TFunction): MenuEntry[] {
  return NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item): MenuEntry[] =>
      item.children?.length
        ? item.children.map((child) => ({
            group: t(groupKey(group.key)),
            parent: t(item.i18nKey),
            label: t(child.i18nKey),
            item: child,
          }))
        : [{ group: t(groupKey(group.key)), parent: null, label: t(item.i18nKey), item }],
    ),
  );
}

/** The sidebar's rule: the single code, and any one of the list; modules switched off hide. */
function opens(
  item: NavItemConfig,
  has: (code: string) => boolean,
  off: ReadonlySet<string>,
): boolean {
  if (item.moduleCode && off.has(item.moduleCode)) return false;
  return (
    (!item.requiredPermission || has(item.requiredPermission)) &&
    (!item.requiredPermissions || item.requiredPermissions.some(has))
  );
}

interface Workflow {
  id: string;
  area: string;
  title: string;
  steps: string;
  expected: string;
}

export function casesFor(
  role: { code: string; label: string },
  has: (code: string) => boolean,
  off: ReadonlySet<string>,
  t: TFunction,
): TestCase[] {
  const id = (key: string) => `${role.code}:${key}`;
  const login = `test_${role.code}`.slice(0, 30);
  const entries = menu(t);
  const seen = entries.filter((e) => opens(e.item, has, off));
  const hidden = entries.filter((e) => !opens(e.item, has, off));
  const cases: TestCase[] = [
    {
      id: id("sign-in"),
      type: "Sign in",
      area: "Sign in",
      title: `Sign in as ${role.label}`,
      steps: `app.medbrains.in → hospital code AMH → username ${login} and the password from your test-accounts file.`,
      expected: `You are signed in; the header shows 'TEST - ${role.label}'; you land on a page you can use (not an error).`,
    },
    ...seen.map((e) => ({
      id: id(`see:${e.item.path}`),
      type: "Should see" as const,
      area: e.group,
      title: `Open ${e.label}`,
      steps: `Menu → ${e.group} → ${e.parent ? `${e.parent} → ` : ""}${e.label}  (${e.item.path})`,
      expected:
        "The screen opens with no 'access denied' or error message. Lists load; an empty list says so. " +
        "Buttons to add or change things appear only where this role should do that." +
        (e.item.moduleCode ? " (Hidden if the hospital has this module switched off.)" : ""),
      path: e.item.path,
    })),
  ];
  if (hidden.length > 0) {
    cases.push({
      id: id("menu"),
      type: "Must not see",
      area: "Menu",
      title: "Menu shows only this role's screens",
      steps: "Look through every menu group.",
      expected: `These must NOT be in the menu: ${hidden.map((e) => e.label).join(", ")}.`,
    });
    const byPath = new Map(hidden.map((e) => [e.item.path, e]));
    for (const path of SENSITIVE.filter((p) => byPath.has(p)).slice(0, 4)) {
      const e = byPath.get(path) as MenuEntry;
      cases.push({
        id: id(`url:${path}`),
        type: "Must not see",
        area: e.group,
        title: `Typing the address of ${e.label}`,
        steps: `Type app.medbrains.in${path} into the address bar.`,
        expected:
          "You get an 'access denied' page or are sent back — none of that screen's data is shown, even briefly.",
        path,
      });
    }
  }
  const own = (workflows as Record<string, Workflow[]>)[role.code] ?? [];
  for (const w of own) {
    cases.push({
      id: id(w.id),
      type: "Workflow",
      area: w.area,
      title: w.title,
      steps: w.steps,
      expected: w.expected,
    });
  }
  return cases;
}
