/**
 * Camp registration workflows, shaped by what the real data actually looks
 * like.
 *
 * Every scenario here comes from a measured characteristic of the Alagappa
 * camp extract — 1,542 registrations across three days in August 2026 — not
 * from imagining what a patient record might contain. Tidy fixtures do not
 * find bugs; this data is wrong in the specific ways a ward is wrong.
 *
 *   72   same-day UHID collisions, none sharing a name
 *   123  registrations with no gender recorded
 *   35   with no legible name
 *   24   with no age
 *   1122 of 1542 (73%) with no diagnosis
 *   273  with no systolic reading
 *   476  of 1269 measured at BP stage 2 (>=140/90)
 *   562  unresolved village spellings
 *
 * Each test states which of those it stands for, so a failure says what broke
 * in the field rather than what broke in a fixture.
 *
 * These drive the UI, not the API. The API path is already covered by the
 * contract checks; what is not covered is whether a receptionist can complete
 * a registration when the form in front of them is half empty.
 */

import { expect, test, type Page } from "@playwright/test";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";
import {
  browserCookiesFromLogin,
  getE2EIdentity,
  loginForSession,
} from "../helpers/e2e-identities";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/** Forward /api/* straight to the backend — the Vite proxy is unreliable under Playwright. */
async function routeApiDirect(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      try {
        await route.fulfill({
          response: await route.fetch({ url: `${BACKEND_URL}${url.pathname}${url.search}` }),
        });
      } catch {
        // navigated away mid-flight
      }
    },
  );
}

async function signIn(page: Page) {
  const admin = getE2EIdentity("super_admin");
  const session = await loginForSession(page.request, admin.username, admin.password);
  await page.context().addCookies(browserCookiesFromLogin(session));
}

/**
 * A name unique to this run.
 *
 * Camp data is full of repeated names — real families share them — so tests
 * must not depend on a name being unique in the database. They depend on it
 * being unique to *this run*.
 */
const runTag = () => `E2E${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;

test.beforeEach(async ({ page }) => {
  await routeApiDirect(page);
  await signIn(page);
});

interface CampRegistration {
  person_name: string;
  age: number | null;
  phone: string | null;
  patient_id: string | null;
}

/** A camp of this run, whose registration form the clerk works from. */
async function openCamp(page: Page): Promise<{ id: string; ctx: AuthContext }> {
  const ctx = await getAuthContextFromCookies(page.request);
  const camp = await api<{ id: string }>(ctx, "POST", "/api/camp/camps", {
    name: `Real-data camp ${runTag()}`,
    camp_type: "general_health",
    scheduled_date: new Date().toISOString().slice(0, 10),
  });
  return { id: camp.id, ctx };
}

/** What the camp's register holds for this name. */
async function registered(ctx: AuthContext, campId: string, name: string) {
  const rows = await api<CampRegistration[]>(
    ctx,
    "GET",
    `/api/camp/registrations?camp_id=${campId}&q=${encodeURIComponent(name)}`,
  );
  return rows.filter((r) => r.person_name === name);
}

/** The camp's own registration form: a clerk working from a paper form. */
async function registerAtCamp(
  page: Page,
  campId: string,
  person: { name: string; age?: string; phone?: string },
) {
  await page.goto(`/camp/${campId}/work/registrations/new`);
  await page.getByLabel(/^Person Name/).fill(person.name);
  if (person.age) await page.getByLabel(/^Age$/).fill(person.age);
  if (person.phone) await page.getByLabel(/^Phone$/).fill(person.phone);
  await page.getByTestId("btn-register").click();
}

test.describe("camp registration, with real-world imperfect records", () => {
  /**
   * Baseline. If this fails nothing below is meaningful, so it runs first and
   * asserts the least.
   */
  test("a complete registration reaches the camp register", async ({ page }) => {
    const { id, ctx } = await openCamp(page);
    const name = `Complete ${runTag()}`;
    await registerAtCamp(page, id, { name, age: "47" });
    await expect.poll(async () => (await registered(ctx, id, name)).length).toBe(1);
  });

  /**
   * 123 of 1,542 real registrations have no gender. A camp clerk transcribing
   * a paper form often cannot read the tick box.
   *
   * The wrong behaviour is a hard block: the patient is standing at the desk,
   * and refusing to register them because a box is unreadable turns a data
   * gap into a care gap. Either the field is optional, or the form must say
   * plainly what to do.
   */
  test("a patient with no recorded gender can still be registered", async ({ page }) => {
    const { id, ctx } = await openCamp(page);
    const name = `NoGender ${runTag()}`;
    // gender deliberately untouched
    await registerAtCamp(page, id, { name, age: "34" });
    const explained = page.getByText(/gender is required/i).first();
    // One or the other must happen. Silence — neither a record nor a reason —
    // is the failure: the clerk is left staring at a form that did nothing.
    await expect
      .poll(async () => (await registered(ctx, id, name)).length > 0 || (await explained.isVisible()))
      .toBe(true);
  });

  /**
   * 24 registrations carry no age. Age drives paediatric dosing and screening
   * eligibility, so a system that silently defaults it to 0 is worse than one
   * that leaves it blank — a 0 reads as a neonate.
   */
  test("a missing age is left empty, never defaulted to zero", async ({ page }) => {
    const { id, ctx } = await openCamp(page);
    const name = `NoAge ${runTag()}`;
    await registerAtCamp(page, id, { name });
    await expect.poll(async () => (await registered(ctx, id, name)).length).toBe(1);
    const [row] = await registered(ctx, id, name);
    expect(row?.age, "an unknown age is stored as unknown, not 0").toBeNull();
  });

  /**
   * The one that matters most: 72 UHID collisions, all on the same camp day,
   * and not one pair shares a name. Two different people were handed the same
   * number.
   *
   * `find_or_create_patient` already carries a scar for this class of bug —
   * "family members share phones, phone alone booked into the wrong record" —
   * so it matches on phone AND name. This asserts the rule holds: two
   * different names must never collapse into one record, whatever they share.
   */
  test("two different people sharing a phone stay two records", async ({ page }) => {
    const { id, ctx } = await openCamp(page);
    const tag = runTag();
    const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const people = [`Collide A ${tag}`, `Collide B ${tag}`];
    for (const name of people) {
      await registerAtCamp(page, id, { name, age: "52", phone });
      await expect.poll(async () => (await registered(ctx, id, name)).length).toBe(1);
    }
    // Both must survive. Merging them hands one patient another's history.
    const [a] = await registered(ctx, id, people[0] ?? "");
    const [b] = await registered(ctx, id, people[1] ?? "");
    if (a?.patient_id && b?.patient_id) {
      expect(a.patient_id, "two people, two patient records").not.toBe(b.patient_id);
    }
  });
});

test.describe("camp workspace", () => {
  /**
   * The camp page is routed and the backend has 44 camp handlers. This asserts
   * the surface actually loads — the failure mode found four times in one day
   * was a complete backend behind a screen that was never wired.
   */
  test("the camp workspace opens and lists camps", async ({ page }) => {
    await page.goto("/camp");
    await expect(page).toHaveURL(/\/camp/);
    // Either camps, or an honest empty state. A blank page is neither.
    const anyContent = page
      .getByRole("heading", { name: /camp/i })
      .or(page.getByText(/no camps|create a camp|add camp/i));
    await expect(anyContent.first()).toBeVisible({ timeout: 15_000 });
  });
});
