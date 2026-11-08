import type { SignableTypes } from "@/hooks/useSignableTypes";

/** What the sign-off inbox offers on one pending entry. */
export type SignoffAction = "sign" | "refill" | "substitution" | "none";

/**
 * The inbox's action for an entry: the two decisions it owns, a signature
 * only for a type the server lists as signable (so the inbox can never offer
 * one the server refuses), otherwise nothing.
 */
export function signoffAction(recordType: string, types: SignableTypes | undefined): SignoffAction {
  if (recordType === "refill_request") return "refill";
  if (recordType === "store_substitution") return "substitution";
  return types?.has(recordType) ? "sign" : "none";
}

/** The inbox label for a record type: the server's name, else a readable code. */
export function signoffLabel(recordType: string, types: SignableTypes | undefined): string {
  if (recordType === "refill_request") return "Refill request";
  if (recordType === "store_substitution") return "Substitute";
  return types?.get(recordType)?.label ?? recordType.replace(/_/g, " ");
}
