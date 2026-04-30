/**
 * BME AMC contractor module — sample. View open AMC work orders for
 * this vendor's contracts, log a service visit, upload a calibration
 * cert. Targets vendors who aren't on hospital MDM.
 *
 * SKELETON. Backend `/api/portal/vendor/work-orders` does not exist
 * yet — real data wiring follows once a vendor pilot is signed up.
 */

import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { Module } from "@medbrains/mobile-shell";

function BmeAmcScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.canvas }}
      contentContainerStyle={{ padding: SPACING.md }}
    >
      <View style={{ marginBottom: SPACING.md }}>
        <Text
          variant="labelSmall"
          style={{
            color: COLORS.brandDeep,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontFamily: "JetBrainsMono-Regular",
          }}
        >
          VENDOR · DRAFT
        </Text>
        <Text
          variant="headlineMedium"
          style={{ color: COLORS.brand, marginTop: 4 }}
        >
          AMC work orders
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: COLORS.ink, opacity: 0.75, marginTop: 4 }}
        >
          Open AMC tickets for your contracts. Log service visits and upload
          calibration certificates.
        </Text>
      </View>
      <Card eyebrow="SKELETON" title="Not wired to backend yet" accent>
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          This app is a vendor-architecture skeleton. The backend
          `/api/portal/vendor/work-orders` endpoint follows once a vendor
          pilot is signed up. See `apps/mobile-vendor/README.md`.
        </Text>
      </Card>
    </ScrollView>
  );
}

export const bmeAmcModule: Module = {
  id: "bme-amc",
  displayName: "AMC work orders",
  icon: () => null,
  requiredPermissions: [],
  navigator: BmeAmcScreen,
};
