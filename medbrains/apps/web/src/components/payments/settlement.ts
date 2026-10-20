import type { PaymentGatewayTransaction, PosTenderInput } from "@medbrains/types";
import type { PaymentModalSettlement } from "@/components/PaymentModal";

/**
 * A captured gateway payment (online checkout, live UPI QR, UPI collect) as
 * the tender it settles. It names the captured payment, so a counter sale
 * claims that very payment — one QR pays one sale — instead of filing an
 * unlinked UPI tender beside money nothing points at.
 */
export function capturedSettlement(
  txn: PaymentGatewayTransaction,
  amount: number = Number(txn.amount),
): PaymentModalSettlement {
  return {
    source: "gateway",
    mode: txn.payment_method === "card" ? "card" : "upi",
    amount,
    reference_number: txn.gateway_payment_id ?? txn.id,
    gateway_transaction_id: txn.id,
  };
}

/** A settled payment modal as the counter sale's tenders. */
export function posTendersOf(settlement: PaymentModalSettlement): PosTenderInput[] {
  const parts: PosTenderInput[] = (settlement.parts ?? []).map((part) => ({
    mode: part.mode,
    amount: part.amount,
    reference: part.reference,
    gateway_transaction_id: part.gateway_transaction_id,
  }));
  if (settlement.amount > 0) {
    parts.push({
      mode: settlement.mode,
      amount:
        settlement.mode === "cash" ? (settlement.tendered ?? settlement.amount) : settlement.amount,
      reference: settlement.reference_number,
      gateway_transaction_id: settlement.gateway_transaction_id,
    });
  }
  return parts;
}
