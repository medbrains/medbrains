/**
 * Patient → prescriptions.
 *
 * Grouped by prescription rather than listed flat, because a prescription is
 * how it was written and how the pharmacy dispenses it — a flat list of
 * medicines from different visits reads as one regimen and invites someone to
 * take a course they finished months ago.
 *
 * Each medicine leads with its name and then how to take it, which is the order
 * somebody standing at a cupboard needs.
 */

import type { Module } from "@medbrains/mobile-shell";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { SectionList, View } from "react-native";
import { Text } from "react-native-paper";
import type { PortalPrescriptionItem } from "../api/portal.js";
import { listPortalPrescriptions } from "../api/portal.js";
import { EntityRow } from "../components/entity-row.js";
import { ScreenHeader } from "../components/screen-header.js";
import { useFetch } from "../lib/use-fetch.js";

const MAX_ITEMS = 200;

interface PrescriptionSection {
  title: string;
  data: PortalPrescriptionItem[];
}

function PrescriptionsScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listPortalPrescriptions, []);

  /**
   * Grouped with a Map keyed by prescription so this stays linear — the list is
   * bounded but a nested find-per-item would still be needless work on a phone.
   */
  const sections = useMemo<PrescriptionSection[]>(() => {
    const byPrescription = new Map<string, PortalPrescriptionItem[]>();
    for (const item of (data ?? []).slice(0, MAX_ITEMS)) {
      const existing = byPrescription.get(item.prescription_id);
      if (existing) {
        existing.push(item);
      } else {
        byPrescription.set(item.prescription_id, [item]);
      }
    }
    return Array.from(byPrescription.values()).map((items) => ({
      title: new Date(items[0]?.prescribed_at ?? "").toLocaleDateString(),
      data: items,
    }));
  }, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="MEDICINES"
        title="Your prescriptions"
        description="What was prescribed, and how to take it."
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load your prescriptions"
          description={error}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && sections.length === 0 && (
        <Empty title="No prescriptions yet" description="Nothing has been prescribed to you." />
      )}

      {!loading && !error && sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.prescription_id}-${item.drug_name}-${index}`}
          renderSectionHeader={({ section }) => (
            <Text
              variant="labelMedium"
              style={{
                color: COLORS.brandDeep,
                paddingTop: SPACING.sm,
                paddingBottom: SPACING.xs,
              }}
            >
              Prescribed {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: SPACING.sm }}>
              <EntityRow
                title={item.drug_name}
                subtitle={`${item.dosage} · ${item.frequency} · ${item.duration}`}
              />
            </View>
          )}
          contentContainerStyle={{ padding: SPACING.md }}
          ListFooterComponent={
            <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7 }}>
              Do not start or stop a medicine without asking your doctor.
            </Text>
          }
        />
      )}
    </View>
  );
}

export const prescriptionsModule: Module = {
  id: "prescriptions",
  displayName: "Medicines",
  icon: () => null,
  navigator: PrescriptionsScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient"],
  tags: ["patient", "prescriptions", "medicines"],
};
