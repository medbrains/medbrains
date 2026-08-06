/**
 * Scan a specimen tube and act on the order it belongs to.
 *
 * A lab tech holding a tube has to find its order before they can record
 * anything against it. Typing a barcode off a curved label, in a room where
 * both hands are usually occupied, is how the wrong order gets picked — and
 * picking the wrong order means a result lands on the wrong patient's chart.
 * Reading the label with the camera removes the transcription step entirely.
 *
 * The barcode resolves against the order list the app already holds, so there
 * is no new endpoint and no round trip per scan. A tube that matches nothing on
 * the list is the interesting case, not an error to swallow: it means the
 * specimen is not one this lab is expecting, and that is exactly the event
 * worth stopping on.
 */

import { BarcodeScanner } from "@medbrains/mobile-shell";
import type { LabOrder } from "@medbrains/types";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import { collectSample, listLabOrders } from "../../api/lab.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

type ScanOutcome =
  | { kind: "matched"; order: LabOrder }
  | { kind: "unknown"; value: string }
  | { kind: "collected"; order: LabOrder };

export function ScanSampleScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(() => listLabOrders(), []);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [scanRound, setScanRound] = useState(0);

  /**
   * Map rather than a scan of the list: a lab holds hundreds of open orders and
   * this runs on every frame that decodes.
   */
  const byBarcode = useMemo(() => {
    const index = new Map<string, LabOrder>();
    for (const order of data?.orders ?? []) {
      if (order.sample_barcode) {
        index.set(order.sample_barcode.trim().toUpperCase(), order);
      }
    }
    return index;
  }, [data]);

  const handleScan = useCallback(
    (value: string) => {
      const order = byBarcode.get(value.trim().toUpperCase());
      setFailure(null);
      setOutcome(order ? { kind: "matched", order } : { kind: "unknown", value });
    },
    [byBarcode],
  );

  const scanAgain = useCallback(() => {
    setOutcome(null);
    setFailure(null);
    setScanRound((round) => round + 1);
  }, []);

  const markCollected = useCallback(async (order: LabOrder) => {
    setBusy(true);
    setFailure(null);
    try {
      await collectSample(order.id);
      setOutcome({ kind: "collected", order });
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not record the collection.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (loading) {
    return (
      <Frame>
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame>
        <Empty
          title="Couldn't load the order list"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      </Frame>
    );
  }

  if (!outcome) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <BarcodeScanner
          title="Point the camera at the tube label"
          hint={`${byBarcode.size} open orders on file`}
          onScan={handleScan}
          resumeKey={scanRound}
        />
      </View>
    );
  }

  return (
    <Frame>
      <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
        {failure && (
          <HelperText type="error" visible accessibilityRole="alert">
            {failure}
          </HelperText>
        )}

        {outcome.kind === "unknown" && (
          <>
            <Badge tone="alert" label="Not on this lab's list" />
            <Text variant="titleMedium" style={{ color: COLORS.ink }}>
              Nothing here matches that label
            </Text>
            <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.8 }}>
              The tube reads {outcome.value}. No open order carries that barcode, so this specimen
              was not expected here. Check the label against the request before you go further — do
              not record anything against another order.
            </Text>
          </>
        )}

        {outcome.kind === "matched" && (
          <>
            <EntityRow
              title={`Order ${outcome.order.id.slice(0, 8)}`}
              subtitle={`${outcome.order.sample_barcode ?? ""} · ${outcome.order.status}`}
              badge={{
                label: outcome.order.is_stat ? "STAT" : outcome.order.priority,
                tone: outcome.order.is_stat ? "alert" : "info",
              }}
            />
            {outcome.order.collected_at ? (
              <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.8 }}>
                Collection was already recorded for this tube. Nothing further to do here.
              </Text>
            ) : (
              <Button
                mode="contained"
                onPress={() => markCollected(outcome.order)}
                loading={busy}
                disabled={busy}
                accessibilityLabel="Record this sample as collected"
              >
                {busy ? "Recording…" : "Record as collected"}
              </Button>
            )}
          </>
        )}

        {outcome.kind === "collected" && (
          <>
            <Badge tone="success" label="Recorded" />
            <Text variant="titleMedium" style={{ color: COLORS.ink }}>
              Collection recorded
            </Text>
            <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.8 }}>
              {outcome.order.sample_barcode} is now marked collected.
            </Text>
          </>
        )}

        <Button mode="outlined" onPress={scanAgain} accessibilityLabel="Scan the next tube">
          Scan the next tube
        </Button>
      </View>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }): ReactNode {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="LAB"
        title="Scan a specimen"
        description="Reads the tube label and finds its order."
      />
      {children}
    </View>
  );
}
