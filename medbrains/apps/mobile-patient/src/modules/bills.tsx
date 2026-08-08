/**
 * Patient → bills.
 *
 * The first screen in this app backed by real data. Everything here comes from
 * `/api/portal/bills`, which scopes to the caller's own record from the token —
 * this screen never sends a patient id, because there is none to send.
 *
 * What a patient wants from a bill screen is one number: what do I still owe.
 * The list underneath is the evidence for it, newest first, and an amount still
 * outstanding is the only thing given any emphasis.
 */

import type { Module } from "@medbrains/mobile-shell";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { PortalInvoice } from "../api/portal.js";
import { listPortalBills } from "../api/portal.js";
import { EntityRow } from "../components/entity-row.js";
import { ScreenHeader } from "../components/screen-header.js";
import { useFetch } from "../lib/use-fetch.js";

/** Bounded like every other list on a constrained surface. */
const MAX_ROWS = 100;

function BillsScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listPortalBills, []);

  const invoices = useMemo(() => (data ?? []).slice(0, MAX_ROWS), [data]);

  /**
   * Summed from the balances rather than read off a status. A partly-paid bill
   * is still money owed however it happens to be labelled.
   */
  const outstanding = useMemo(
    () => invoices.reduce((total, invoice) => total + Number(invoice.balance_due || 0), 0),
    [invoices],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="BILLS"
        title="Your bills"
        description="Invoices, payments and receipts."
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load your bills"
          description={error}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && invoices.length === 0 && (
        <Empty title="No bills yet" description="Nothing has been billed to you." />
      )}

      {!loading && !error && invoices.length > 0 && (
        <>
          <View style={{ padding: SPACING.md, gap: SPACING.xs }}>
            <Text variant="labelMedium" style={{ color: COLORS.brandDeep }}>
              {outstanding > 0 ? "Still to pay" : "Nothing outstanding"}
            </Text>
            <Text variant="headlineMedium" style={{ color: COLORS.ink, fontWeight: "700" }}>
              ₹{outstanding.toFixed(2)}
            </Text>
          </View>
          <FlatList
            data={invoices}
            keyExtractor={(invoice) => invoice.id}
            renderItem={({ item }) => <InvoiceRow invoice={item} />}
            contentContainerStyle={{ padding: SPACING.md }}
          />
        </>
      )}
    </View>
  );
}

function InvoiceRow({ invoice }: { invoice: PortalInvoice }): ReactNode {
  const due = Number(invoice.balance_due || 0);
  const isOwed = due > 0;

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={`₹${Number(invoice.total_amount || 0).toFixed(2)}`}
        subtitle={`${invoice.invoice_number} · ${new Date(invoice.created_at).toLocaleDateString()}`}
        accent={isOwed}
        badge={
          isOwed
            ? { label: `₹${due.toFixed(2)} due`, tone: "warn" }
            : { label: "paid", tone: "success" }
        }
      />
    </View>
  );
}

export const billsModule: Module = {
  id: "bills",
  displayName: "Bills",
  icon: () => null,
  navigator: BillsScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient", "Desktop-Kiosk"],
  tags: ["patient", "billing", "payments", "receipts"],
};
