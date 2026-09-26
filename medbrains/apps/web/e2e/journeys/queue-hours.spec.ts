/**
 * Queue hours (RFCs/modules/RFC-MODULE-token-queues.md, P1c, scenario 22).
 *
 * An OPD gives out tokens during its hours only. A patient registered outside
 * them is still registered, and the desk is told when tokens resume — not left
 * with a UHID and no number, which the receptionist cannot explain.
 */
import type { TenantSummary } from "@medbrains/types";
import { api } from "../helpers/api";
import { QueueAdmin } from "./pages/queue-admin";
import { RegistrationDesk } from "./pages/registration-desk";
import { expect, freshPerson, test } from "./support/world";

/** Minutes since midnight, in the hospital's own time zone. */
function localMinutes(timeZone: string): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .split(":")
    .map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

test("outside its hours the desk registers the patient and is told when tokens resume", async ({
  hospital,
}) => {
  test.setTimeout(120_000);
  const dept = await hospital.department("Evening OPD");
  const queue = await api<{ id: string }>(hospital.admin, "POST", "/api/queues", {
    name: `Hours ${dept.name}`,
    module: "opd",
    scope: "department",
    scope_id: dept.id,
    prefix: "HR",
    start_at: 1,
    pad_width: 3,
    reset_rule: "daily",
    max_tokens_per_period: null,
    lifecycle: "permanent",
    valid_from: null,
    valid_until: null,
    status: "active",
    early_issue_minutes: 0,
  });
  const { timezone } = await api<TenantSummary>(hospital.admin, "GET", "/api/setup/tenant");
  const now = localMinutes(timezone);
  // A session two hours ahead — or, late at night, one that has ended.
  // What the desk is told, and what the admin's list says, in each case.
  const [opens, closes, reason, listed] =
    now < 20 * 60
      ? [now + 120, now + 180, `is closed — tokens from ${hhmm(now + 120)}`, `Closed — tokens from ${hhmm(now + 120)}`]
      : [now - 180, now - 120, "has closed for today", "Closed for today"];

  // The administrator sets the hours.
  const admin = new QueueAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.setHours(queue.id, [{ label: "Clinic", opens: hhmm(opens), closes: hhmm(closes) }]);
  await admin.expectNotTakingTokens(queue.id, listed);

  // The desk registers a walk-in outside those hours.
  const deskPage = await hospital.as("receptionist");
  const desk = new RegistrationDesk(deskPage);
  await desk.open();
  await desk.register({ ...freshPerson(), sex: "Female", department: dept.name });
  await expect(deskPage.getByText("Patient registered — no token yet")).toBeVisible({
    timeout: 15_000,
  });
  await expect(deskPage.getByText(new RegExp(`UHID: \\S+\\. .*${reason}`))).toBeVisible();

  // The administrator clears the hours; the next walk-in gets the queue's number.
  await admin.setHours(queue.id, []);
  await admin.expectTakingTokens(queue.id);
  await desk.open();
  await desk.register({ ...freshPerson(), sex: "Male", department: dept.name });
  await expect(deskPage.getByText(/UHID: \S+ · token HR-001/)).toBeVisible({ timeout: 15_000 });
});
