/**
 * Whether the lab may release results.
 *
 * A QC run that failed means results on that test must not go out. That is an
 * NABL requirement and it is the question a tech actually has at the bench —
 * but it lived only on a desktop screen, so the answer arrived after the
 * results did.
 *
 * The verdict is the server's throughout: it computes the SD index and applies
 * the Westgard rules. This screen orders by severity and says the consequence
 * in words, because "r_4s" tells a tired person nothing.
 */

import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { QcResultRow } from "../../api/lab.js";
import { listQcResults } from "../../api/lab.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { blocksRelease, bySeverity, describeViolations } from "../../lib/lab-qc.js";
import { useFetch } from "../../lib/use-fetch.js";

const MAX_ROWS = 100;

export function QcStatusScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listQcResults, []);

  const runs = useMemo(() => bySeverity(data ?? []).slice(0, MAX_ROWS), [data]);
  const blocking = useMemo(() => runs.filter(blocksRelease).length, [runs]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="LAB"
        title="QC status"
        description="Worst first. Results must not be released on a failed run."
        trailing={blocking > 0 ? <Badge tone="alert" label={`${blocking} blocking`} /> : undefined}
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load QC"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}

      {!loading && !error && runs.length === 0 && (
        <Empty title="No QC runs" description="Nothing has been run yet." />
      )}

      {!loading && !error && runs.length > 0 && (
        <FlatList
          data={runs}
          keyExtractor={(qc) => qc.id}
          renderItem={({ item }) => <QcRow run={item} />}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      )}
    </View>
  );
}

function QcRow({ run }: { run: QcResultRow }): ReactNode {
  const blocked = blocksRelease(run);

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={`Level ${run.level}${run.observed_value ? ` · ${run.observed_value}` : ""}`}
        subtitle={`${run.sd_index ? `${run.sd_index} SD · ` : ""}${describeViolations(
          run.westgard_violations,
        )}`}
        accent={blocked}
        badge={{
          label: run.status,
          tone: run.status === "rejected" ? "alert" : run.status === "warning" ? "warn" : "success",
        }}
      />
      {blocked && (
        <Text
          variant="bodySmall"
          style={{ color: COLORS.ink, opacity: 0.85, marginTop: SPACING.xs }}
        >
          Do not release results for this test until the run is repeated and accepted.
        </Text>
      )}
    </View>
  );
}
