/**
 * Balance payment links and partial payments (#4871): a cashier sends the
 * patient a link for the bill from the Collect drawer; the patient pays part
 * of it; the counter takes the rest in cash; the bill is paid and the link is
 * cancelled, so it can never be paid again.
 *
 * Real screens, real server and its outbox worker. Only Razorpay is stood in
 * for, at its boundary (`support/razorpay.ts`). What was saved is read
 * from the server's database (`E2E_DATABASE_URL`). Server pins:
 * crates/medbrains-server/tests/payment_links_test.rs.
 */
import { expectUsable } from "./support/a11y";
import { billingDepartment, closeCollected, issuedBill, openCollectOnBill } from "./support/billing";
import { db, expectDrawerAccessible } from "./support/collect";
import {
  linkPaidEvent,
  mockUnavailable,
  postWebhook,
  razorpayMock,
  useTestKeys,
} from "./support/razorpay";
import { expect, freshPerson, test } from "./support/world";

test.skip(mockUnavailable !== null, mockUnavailable ?? "");
test.describe.configure({ mode: "serial" });

const linkRow = (invoiceId: string) => {
  const [row] = db(
    `SELECT id || '|' || status || '|' || COALESCE(provider_link_id, '') || '|' || amount_paid || '|' || COALESCE(end_reason, '')
       FROM payment_links WHERE '${invoiceId}' = ANY(invoice_ids) ORDER BY created_at DESC LIMIT 1`,
  );
  const [id = "", status = "", plink = "", paid = "0", ended = ""] = (row ?? "").split("|");
  return { id, status, plink, paid: Number(paid), ended };
};
const bill = (invoiceId: string) => {
  const [row] = db(`SELECT status || '|' || paid_amount FROM invoices WHERE id = '${invoiceId}'`);
  const [status = "", paid = "0"] = (row ?? "").split("|");
  return { status, paid: Number(paid) };
};

test("a link from the drawer, part paid by the patient, the rest in cash, then closed", async ({
  hospital,
  request,
}) => {
  const mock = await razorpayMock();
  await useTestKeys(hospital.setting);
  await hospital.setting("payments", "fallback_provider", null);

  const invoiceId = await issuedBill(hospital.admin, 1000);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [
    await billingDepartment(hospital.admin),
  ]);

  // ── The cashier sends the link from the Collect drawer ──
  let drawer = await openCollectOnBill(page, invoiceId);
  const tile = drawer.getByRole("radio", { name: /Payment link/ });
  await expectUsable(tile, "Payment link tile");
  await tile.click();
  await expectDrawerAccessible(page);
  await drawer.getByRole("button", { name: "Send link for ₹1,000.00" }).click();
  await expect(drawer.getByTestId("payment-link-status")).toHaveText("Sent");
  const url = await drawer.getByTestId("payment-link-url").innerText();
  const sent = linkRow(invoiceId);
  expect(sent.status).toBe("created");
  expect(mock.links.get(sent.plink)?.accept_partial, "the link accepts parts").toBe(true);
  expect(url).toBe(`https://rzp.io/l/${sent.plink}`);
  expect(
    db(`SELECT payload->>'body' FROM outbox_events WHERE event_type = 'sms.payment_link' AND aggregate_id = '${sent.id}'`)[0],
    "the SMS carries the real link",
  ).toContain(url);

  // ── The patient pays ₹400 of it; the drawer shows it live ──
  expect(await postWebhook(request, linkPaidEvent(sent.plink, 40_000, false))).toBe(200);
  await expect(drawer.getByTestId("payment-link-progress")).toHaveText("₹400.00 of ₹1,000.00 paid", {
    timeout: 15_000,
  });
  expect(bill(invoiceId)).toEqual({ status: "partially_paid", paid: 400 });
  expect(linkRow(invoiceId)).toMatchObject({ status: "partially_paid", paid: 400 });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  // ── The counter takes the other ₹600 in cash ──
  drawer = await openCollectOnBill(page, invoiceId);
  await drawer.getByRole("radio", { name: /Cash/ }).click();
  await drawer.getByRole("button", { name: "Collect ₹600.00" }).click();
  await closeCollected(drawer, "₹600.00");
  expect(bill(invoiceId)).toEqual({ status: "paid", paid: 1000 });

  // ── The link closes itself: cancelled at Razorpay, so it can never be paid again ──
  await expect.poll(() => linkRow(invoiceId).status, { timeout: 30_000 }).toBe("cancelled");
  expect(linkRow(invoiceId).ended).toBe("settled");
  expect(mock.cancelledLinks.has(sent.plink)).toBe(true);
  expect(db(`SELECT count(*) FROM payments WHERE invoice_id = '${invoiceId}' AND deleted_at IS NULL`)).toEqual(["2"]);

  await page.reload();
  const card = page.getByTestId("payment-link-card");
  await expect(card.getByTestId("payment-link-status")).toHaveText("Cancelled");
  await expect(card.getByText("Closed: the rest was paid at the counter.")).toBeVisible();
});
