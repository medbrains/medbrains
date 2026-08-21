/**
 * Health → Bands.
 *
 * Where a wearable connects, and where the person sees the truth about it.
 * A band that paired weeks ago and has sent nothing says so — "No data
 * recently" rather than a green dot, because a silence dressed as a connection
 * is the same lie as an empty ward reading as a fact.
 */

import type { Module } from "@medbrains/mobile-shell";
import { Badge, Card, COLORS, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { Band, BandState } from "../health/bands.js";
import { BAND_KIND_LABEL, bandState, describeBandState } from "../health/bands.js";

/** Bounded: a person owns a handful of bands, and a corrupt list must not scroll forever. */
const MAX_BANDS = 20;

const TONE: Readonly<Record<BandState, "success" | "warn" | "neutral">> = {
  reporting: "success",
  stale: "warn",
  never_synced: "neutral",
};

function BandRow({ band, now }: { band: Band; now: Date }): ReactNode {
  const state = bandState(band, now);
  return (
    <View style={{ paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
      <Card tone={TONE[state]}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ color: COLORS.ink }}>
              {band.name}
            </Text>
            <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7 }}>
              {BAND_KIND_LABEL[band.kind]}
            </Text>
          </View>
          <Badge label={describeBandState(state)} tone={TONE[state]} />
        </View>
      </Card>
    </View>
  );
}

/**
 * No bands yet. Pairing is not wired until phase 4 — HealthKit and Health
 * Connect need a config plugin and a dev build (RFC §2.2), and the MedBrains
 * band needs the device-ingest credential that `medbrains-bridge` still lacks.
 * Saying "coming soon" would be a promise; saying what connects is a fact.
 */
function BandsScreen(): ReactNode {
  const bands: readonly Band[] = [];
  const now = new Date();

  return (
    <FlatList
      data={bands.slice(0, MAX_BANDS)}
      keyExtractor={(band) => band.id}
      renderItem={({ item }) => <BandRow band={item} now={now} />}
      ListEmptyComponent={
        <Empty
          title="No band connected"
          description="An Apple Watch, a Health Connect device or a MedBrains band will appear here once paired."
        />
      }
    />
  );
}

export const bandsModule: Module = {
  id: "bands",
  displayName: "Bands",
  icon: () => null,
  navigator: BandsScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient"],
  tags: ["patient", "health", "wearable"],
};
