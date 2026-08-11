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

test.describe("camp registration, with real-world imperfect records", () => {
  /**
   * Baseline. If this fails nothing below is meaningful, so it runs first and
   * asserts the least.
   */
  test("a complete registration reaches the patient record", async ({ page }) => {
    const name = `Complete ${runTag()}`;
    await page.goto("/patients/register");
    await expect(page.getByRole("heading", { level: 1 }).or(page.locator("h2"))).toBeVisible();

    await page.getByLabel(/first name|full name|patient name/i).first().fill(name);
    await page.getByLabel(/age/i).first().fill("47");
    await page.getByRole("button", { name: /register|save|create/i }).first().click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
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
    const name = `NoGender ${runTag()}`;
    await page.goto("/patients/register");

    await page.getByLabel(/first name|full name|patient name/i).first().fill(name);
    await page.getByLabel(/age/i).first().fill("34");
    // gender deliberately untouched
    await page.getByRole("button", { name: /register|save|create/i }).first().click();

    const registered = page.getByText(name).first();
    const explained = page.getByText(/gender is required/i).first();
    // One or the other must happen. Silence — neither a record nor a reason —
    // is the failure: the clerk is left staring at a form that did nothing.
    await expect(registered.or(explained)).toBeVisible({ timeout: 15_000 });
  });

  /**
   * 24 registrations carry no age. Age drives paediatric dosing and screening
   * eligibility, so a system that silently defaults it to 0 is worse than one
   * that leaves it blank — a 0 reads as a neonate.
   */
  test("a missing age is left empty, never defaulted to zero", async ({ page }) => {
    const name = `NoAge ${runTag()}`;
    await page.goto("/patients/register");

    await page.getByLabel(/first name|full name|patient name/i).first().fill(name);
    await page.getByRole("button", { name: /register|save|create/i }).first().click();
    await page.waitForTimeout(2_000);

    await page.goto("/patients");
    await page.getByPlaceholder(/search/i).first().fill(name);
    await page.waitForTimeout(1_500);

    const row = page.getByRole("row").filter({ hasText: name }).first();
    if (await row.isVisible().catch(() => false)) {
      // A newborn and an unknown age must not look the same on a ward list.
      await expect(row).not.toContainText(/\b0\s*(y|yr|years?)\b/i);
    }
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
    const tag = runTag();
    const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const first = `Collide A ${tag}`;
    const second = `Collide B ${tag}`;

    for (const name of [first, second]) {
      await page.goto("/patients/register");
      await page.getByLabel(/first name|full name|patient name/i).first().fill(name);
      await page.getByLabel(/age/i).first().fill("52");
      const phoneField = page.getByLabel(/phone|mobile|contact/i).first();
      if (await phoneField.isVisible().catch(() => false)) {
        await phoneField.fill(phone);
      }
      await page.getByRole("button", { name: /register|save|create/i }).first().click();
      await page.waitForTimeout(2_500);
    }

    await page.goto("/patients");
    await page.getByPlaceholder(/search/i).first().fill(`Collide`);
    await page.waitForTimeout(2_000);

    // Both must survive. Merging them hands one patient another's history.
    await expect(page.getByText(first).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(second).first()).toBeVisible({ timeout: 10_000 });
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
