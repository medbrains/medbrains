/**
 * The hospital a journey runs in: its own department, people logged in as
 * their real roles in separate browsers, and settings put back afterwards.
 *
 * Starting data (a department, a setting) is created through the API; every
 * step the journey is *about* is done through the screen, by the role that
 * does it in a real hospital.
 */
import { test as base, type Browser, type Page } from "@playwright/test";
import { loginAsRole, routeApiDirect } from "../../helpers";
import { type AuthContext, api, getAuthContextFromCookies } from "../../helpers/api";
import { getE2EIdentity } from "../../helpers/e2e-identities";

export interface Department {
  id: string;
  name: string;
}

export interface Hospital {
  /** Admin API context, for starting data only. */
  admin: AuthContext;
  /** A department nobody else's test uses. */
  department: (label: string) => Promise<Department>;
  /** A page logged in as this built-in role, in its own browser. */
  as: (role: string) => Promise<Page>;
  /** An administrator's page (the setup project's session). */
  asAdmin: () => Promise<Page>;
  /** Set a tenant setting for this test; the old value is restored after. */
  setting: (category: string, key: string, value: unknown) => Promise<void>;
  /** The doctor this run logs in as, by the name the desk picks them by. */
  doctor: () => Promise<{ id: string; fullName: string }>;
}

const unique = () => crypto.randomUUID().slice(0, 8).toUpperCase();

async function openPage(browser: Browser, storageState?: string): Promise<Page> {
  const context = await browser.newContext(storageState ? { storageState } : {});
  const page = await context.newPage();
  await routeApiDirect(page);
  return page;
}

export const test = base.extend<{ hospital: Hospital }>({
  hospital: async ({ browser, request }, use) => {
    const admin = await getAuthContextFromCookies(request);
    const pages: Page[] = [];
    const restore: Array<() => Promise<void>> = [];

    await use({
      admin,
      department: async (label) => {
        const suffix = unique();
        const name = `${label} ${suffix}`;
        const dept = await api<{ id: string }>(admin, "POST", "/api/setup/departments", {
          code: `J${suffix}`,
          name,
          department_type: "clinical",
        });
        return { id: dept.id, name };
      },
      as: async (role) => {
        const page = await openPage(browser);
        const identity = getE2EIdentity(role);
        await loginAsRole(page, identity.username, identity.password);
        pages.push(page);
        return page;
      },
      asAdmin: async () => {
        const page = await openPage(browser, "e2e/.auth/user.json");
        pages.push(page);
        return page;
      },
      doctor: async () => {
        const identity = getE2EIdentity("doctor");
        const doctors = await api<Array<{ id: string; full_name: string }>>(
          admin,
          "GET",
          "/api/setup/doctors",
        );
        const me = doctors.find((d) => d.id === identity.id);
        if (!me) throw new Error("the E2E doctor is not in the consultant list");
        return { id: me.id, fullName: me.full_name };
      },
      setting: async (category, key, value) => {
        const rows = await api<Array<{ key: string; value: unknown }>>(
          admin,
          "GET",
          `/api/setup/settings?category=${category}`,
        );
        const previous = rows.find((row) => row.key === key)?.value ?? null;
        await api(admin, "PUT", "/api/setup/settings", { category, key, value });
        restore.push(async () => {
          await api(admin, "PUT", "/api/setup/settings", { category, key, value: previous });
        });
      },
    });

    for (const undo of restore.reverse()) await undo();
    for (const page of pages) await page.context().close();
  },
});

export { expect } from "@playwright/test";

const SYLLABLES = ["ka", "ri", "mo", "tha", "vel", "shan", "ni", "ra", "lu", "dev", "an", "ya"];

/**
 * A person no earlier run registered. Registration's duplicate check compares
 * names and dates of birth fuzzily, so digits on a fixed name are not enough:
 * two runs' "Walkin160236" and "Walkin160911" are the same person to it.
 */
export function freshPerson(): { firstName: string; lastName: string; phone: string; ageYears: number } {
  const pick = () => SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)] ?? "ka";
  const word = (n: number) => {
    const w = Array.from({ length: n }, pick).join("");
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    firstName: word(2),
    lastName: word(3),
    phone: `9${digits.slice(0, 1) === "0" ? "1" : digits.slice(0, 1)}${digits}`,
    ageYears: 20 + Math.floor(Math.random() * 60),
  };
}
