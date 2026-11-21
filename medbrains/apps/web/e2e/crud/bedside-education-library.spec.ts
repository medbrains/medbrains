import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { api, getAuthContextFromCookies } from "../helpers/api";

/**
 * The library that could be read and never filled.
 *
 * bedside_education_videos could be listed, played, and its views tracked.
 * createBedsideVideo and updateBedsideVideo had no caller on any of the
 * eleven app surfaces, so the education section at every bed rendered an
 * empty list and structurally always would — and patient education is one of
 * the main reasons to put a screen at a bed.
 */
test.describe("bedside education library", () => {
  test("the library lists what has been published, without needing a patient", async ({
    page,
    request,
  }) => {
    // Publish first: the worker's hospital starts with an empty library, and the
    // title the test used to look for was only the form's placeholder text.
    const title = `After your surgery: the first 24 hours ${Date.now() % 100000}`;
    const ctx = await getAuthContextFromCookies(request);
    await api(ctx, "POST", "/api/bedside/videos", {
      title,
      video_url: "https://videos.example.org/after-surgery.mp4",
      category: "post_operative",
      language: "en",
    });
    await navigateTo(page, "/bedside-portal");
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
  });

  test("a video can be published from the screen", async ({ page }) => {
    await navigateTo(page, "/bedside-portal");
    await expect(page.getByRole("button", { name: "Add video" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Add video" }).click();
    // The form is the thing that did not exist. Reaching it is the assertion.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Title/ })).toBeVisible();
  });
});
