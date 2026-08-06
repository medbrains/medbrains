/**
 * Scan a pack on the shelf and record the movement there.
 *
 * Stock entry has always meant carrying a pack to a terminal, or writing the
 * name on paper and typing it in later. Both are how the count drifts from the
 * shelf: the paper round gets batched at the end of a shift, by which point
 * nobody is sure which pack the line referred to.
 *
 * Scanning identifies the product exactly. That matters more here than in most
 * places, because a drug catalogue is full of names that differ by a milligram.
 *
 * What this deliberately does NOT do is dispense. Dispensing a controlled drug
 * needs a witness, a duplicate retained prescription and the dual-lock, and
 * that ritual belongs at the counter where the safe is — putting it on a phone
 * would invite it being performed somewhere else. This screen moves stock; it
 * does not hand anything to a patient.
 */

import { BarcodeScanner } from "@medbrains/mobile-shell";
import { Badge, COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { ActivityIndicator, Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import type { CatalogItemRow, StockMovement } from "../../api/pharmacy.js";
import { findCatalogByBarcode, recordStockTransaction } from "../../api/pharmacy.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";

const MOVEMENTS: ReadonlyArray<{ value: StockMovement; label: string }> = [
  { value: "receipt", label: "Received" },
  { value: "issue", label: "Issued" },
  { value: "return", label: "Returned" },
  { value: "adjustment", label: "Correction" },
];

type Stage =
  | { kind: "scanning" }
  | { kind: "looking-up"; barcode: string }
  | { kind: "unknown"; barcode: string }
  | { kind: "found"; item: CatalogItemRow }
  | { kind: "recorded"; item: CatalogItemRow; movement: StockMovement; quantity: number };

export function ScanStockScreen(): ReactNode {
  const [stage, setStage] = useState<Stage>({ kind: "scanning" });
  const [movement, setMovement] = useState<StockMovement>("receipt");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanRound, setScanRound] = useState(0);

  const handleScan = useCallback(async (value: string) => {
    setStage({ kind: "looking-up", barcode: value });
    setError(null);
    try {
      const matches = await findCatalogByBarcode(value);
      const item = matches[0];
      setStage(item ? { kind: "found", item } : { kind: "unknown", barcode: value });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not look that barcode up.");
      setStage({ kind: "unknown", barcode: value });
    }
  }, []);

  const scanAgain = useCallback(() => {
    setStage({ kind: "scanning" });
    setQuantity("");
    setNotes("");
    setError(null);
    setScanRound((round) => round + 1);
  }, []);

  const parsedQuantity = Number.parseInt(quantity, 10);
  const quantityError =
    quantity.trim() === ""
      ? null
      : !Number.isFinite(parsedQuantity) || parsedQuantity <= 0
        ? "Enter a whole number of units, more than zero."
        : null;

  const record = useCallback(
    async (item: CatalogItemRow) => {
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await recordStockTransaction({
          catalog_item_id: item.id,
          transaction_type: movement,
          quantity: parsedQuantity,
          notes: notes.trim() || undefined,
        });
        setStage({ kind: "recorded", item, movement, quantity: parsedQuantity });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not record the movement.");
      } finally {
        setBusy(false);
      }
    },
    [movement, notes, parsedQuantity],
  );

  if (stage.kind === "scanning") {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <BarcodeScanner
          title="Point the camera at the pack"
          hint="The barcode on the carton, not the batch number"
          onScan={handleScan}
          resumeKey={scanRound}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="PHARMACY"
        title="Stock movement"
        description="Recorded against your name."
      />
      <FormScrollView>
        {error && (
          <HelperText type="error" visible accessibilityRole="alert">
            {error}
          </HelperText>
        )}

        {stage.kind === "looking-up" && (
          <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
            <ActivityIndicator />
            <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7 }}>
              Looking up {stage.barcode}
            </Text>
          </View>
        )}

        {stage.kind === "unknown" && (
          <>
            <Badge tone="alert" label="Not in the catalogue" />
            <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.85 }}>
              No product carries the barcode {stage.barcode}. Either the pack has not been given one
              yet, or this is not a product this pharmacy stocks. Add the barcode to the catalogue
              entry first — recording a movement against the wrong product is worse than recording
              none.
            </Text>
          </>
        )}

        {stage.kind === "found" && (
          <>
            <EntityRow
              title={stage.item.name}
              subtitle={`${stage.item.code} · ON HAND ${stage.item.current_stock}${
                stage.item.unit ? ` ${stage.item.unit}` : ""
              }`}
              badge={
                stage.item.is_controlled
                  ? { label: "controlled", tone: "alert" }
                  : stage.item.drug_schedule
                    ? { label: `Schedule ${stage.item.drug_schedule}`, tone: "warn" }
                    : undefined
              }
              accent={stage.item.current_stock <= stage.item.reorder_level}
            />
            {stage.item.is_controlled && (
              <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.85 }}>
                Controlled substance. Movements here are stock only — dispensing needs the witness
                and register entry at the counter.
              </Text>
            )}

            <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
              What happened
            </Text>
            <SegmentedButtons
              value={movement}
              onValueChange={(value) => setMovement(value as StockMovement)}
              buttons={MOVEMENTS.map((m) => ({
                value: m.value,
                label: m.label,
                accessibilityLabel: m.label,
              }))}
            />

            <MobileTextField
              label={`How many${stage.item.unit ? ` (${stage.item.unit})` : ""}`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              error={Boolean(quantityError)}
            />
            <HelperText type="error" visible={Boolean(quantityError)}>
              {quantityError ?? " "}
            </HelperText>

            <MobileTextField
              label="Note (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />

            <Button
              mode="contained"
              onPress={() => record(stage.item)}
              loading={busy}
              disabled={busy || !quantity.trim() || Boolean(quantityError)}
              accessibilityLabel="Record this stock movement"
            >
              {busy ? "Recording…" : "Record movement"}
            </Button>
          </>
        )}

        {stage.kind === "recorded" && (
          <>
            <Badge tone="success" label="Recorded" />
            <Text variant="titleMedium" style={{ color: COLORS.ink }}>
              {stage.quantity} {stage.item.unit ?? "units"} · {stage.movement}
            </Text>
            <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.8 }}>
              {stage.item.name} is updated.
            </Text>
          </>
        )}

        {stage.kind !== "looking-up" && (
          <Button mode="outlined" onPress={scanAgain} accessibilityLabel="Scan the next pack">
            Scan the next pack
          </Button>
        )}
      </FormScrollView>
    </View>
  );
}
