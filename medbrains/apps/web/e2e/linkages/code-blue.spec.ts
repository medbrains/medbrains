/**
 * Code blue — nursing → notifications → response → NABH.
 *
 * The first linkage suite, on the event with a heart behind it. A code blue
 * is started by a nurse and its effects live in three other places: the
 * notification feed of every active doctor and nurse (the page), the
 * responders list (who is coming), and the stand-down that reaches exactly
 * the people the page reached. None of that is in the response to the
 * request that started it, so none of it was tested before this file.
 *
 * Every positive here has a negative beside it: a billing clerk is never
 * paged, an answered arrest still shows the page as unread, and answering an
 * arrest that has ended is a 404 rather than a silent success.
 *
 * The table-only half — the outbox rows and NABH's team_arrived_at — is in
 * crates/medbrains-server/tests/linkage_code_blue_test.rs.
 */

import { expect, test } from "@playwright/test";
import { routeApiDirect } from "../helpers";
import { expectAbsent, getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  createPatientApi,
  endCodeBlue,
  listCodeBlueResponders,
  listNotifications,
  type NotificationLite,
  respondCodeBlue,
  startCodeBlue,
} from "../helpers/journey-steps";

const pagedFor = (id: string) => (n: NotificationLite) =>
  n.title === "CODE BLUE" && n.entity_type === "code_blue" && n.entity_id === id;
const stoodDownFor = (id: string) => (n: NotificationLite) =>
  n.title === "Code blue stood down" && n.entity_id === id;

test.describe("Code blue reaches the people who can answer it", () => {
  test("page → doctor and nurse; not the clerk; responder listed; stand-down to the same people", async ({
    request,
    page,
  }) => {
    const admin = await getAuthContextFromCookies(request);
    const nurse = await loginAsRoleApi(request, "nurse");
    const doctor = await loginAsRoleApi(request, "doctor");
    const clerk = await loginAsRoleApi(request, "billing_clerk");

    const patient = await createPatientApi(admin);
    const location = `E2E Ward ${Date.now().toString(36)}`;
    const { id } = await startCodeBlue(nurse, { patientId: patient.id, location });

    // The page: async, so poll — as the recipients themselves.
    const doctorPage = await pollUntil(
      () => listNotifications(doctor, { unread: true }),
      (list) => list.some(pagedFor(id)),
      { label: "doctor paged" },
    );
    const paged = doctorPage.find(pagedFor(id));
    expect(paged?.action_url).toBe("/nurse?tab=code-blue");
    expect(paged?.body).toContain(location);
    await pollUntil(
      () => listNotifications(nurse, { unread: true }),
      (list) => list.some(pagedFor(id)),
      { label: "nurse paged" },
    );
    // A billing clerk is not clinical staff. Three worker cycles of silence.
    await expectAbsent(() => listNotifications(clerk), (list) => list.some(pagedFor(id)), {
      label: "clerk paged",
    });

    // The answer: synchronous, and one per person however many taps.
    await respondCodeBlue(nurse, id);
    await respondCodeBlue(nurse, id);
    const responders = (await listCodeBlueResponders(admin)).filter((r) => r.code_blue_id === id);
    expect(responders.map((r) => r.user_id)).toEqual([nurse.userId]);
    expect(responders[0]?.seconds_after_call).toBeGreaterThanOrEqual(0);

    // The screen the page links to shows the arrest while it is live.
    await routeApiDirect(page);
    await page.goto("/nurse?tab=code-blue");
    await expect(page.getByText(location)).toBeVisible();

    // Stand-down: to exactly the people who were paged, and the page stays
    // unread — a page nobody opened is evidence about the response.
    await endCodeBlue(nurse, id, "rosc");
    for (const [who, ctx] of [
      ["doctor", doctor],
      ["nurse", nurse],
    ] as const) {
      const list = await pollUntil(
        () => listNotifications(ctx, { unread: true }),
        (l) => l.some(stoodDownFor(id)),
        { label: `${who} stood down` },
      );
      expect(list.some(pagedFor(id)), `${who}'s original page must still be unread`).toBe(true);
    }
    await expectAbsent(() => listNotifications(clerk), (list) => list.some(stoodDownFor(id)), {
      label: "clerk stood down",
    });

    // Answering an arrest that has ended is not a response and must not be
    // recorded as one — it would become the team's arrival time.
    await respondCodeBlue(nurse, id, { expectStatus: 404 });
  });
});
