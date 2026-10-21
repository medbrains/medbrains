// A balance link's state in words a cashier and a patient read the same way
// (#4871) — pure, so the wording is tested without a screen.
import type { PaymentLinkView } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

const rupees = (value: number): string =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Still takes money. */
export function isLive(link: Pick<PaymentLinkView, "status">): boolean {
  return link.status === "created" || link.status === "partially_paid";
}

/** The badge: what happened, never colour alone. */
export function linkBadge(link: PaymentLinkView): { label: string; tone: BadgeTone } {
  switch (link.status) {
    case "pending":
      return { label: "Being made", tone: "neutral" };
    case "created":
      return { label: link.sent_count > 0 ? "Sent" : "Ready", tone: "info" };
    case "partially_paid":
      return { label: "Part paid", tone: "warning" };
    case "paid":
      return { label: "Paid", tone: "success" };
    case "expired":
      return { label: "Expired", tone: "neutral" };
    case "cancelled":
      return { label: link.end_reason === "replaced" ? "Replaced" : "Cancelled", tone: "neutral" };
    case "failed":
      return { label: "Not made", tone: "danger" };
  }
}

/** "₹500.00 of ₹1,000.00 paid", or what it asks for while nothing is paid. */
export function linkProgress(link: PaymentLinkView): string {
  const asked = Number(link.amount);
  const paid = Number(link.amount_paid);
  if (paid <= 0) return `Asks for ${rupees(asked)}`;
  return `${rupees(paid)} of ${rupees(asked)} paid`;
}

/** Why it closed, when it closed for a reason a cashier should know. */
export function linkEnding(link: PaymentLinkView): string | null {
  switch (link.end_reason) {
    case "settled":
      return "Closed: the rest was paid at the counter.";
    case "balance_changed":
      return "Closed: the balance changed; a link for the new balance was sent.";
    case "replaced":
      return "Closed: a newer link replaced it.";
    case "cancelled_by_staff":
      return "Cancelled at the desk.";
    default:
      return link.status === "failed" ? (link.error ?? "The provider made no link.") : null;
  }
}
