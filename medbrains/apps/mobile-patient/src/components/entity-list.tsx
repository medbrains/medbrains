/**
 * Generic entity list screen — handles loading / error / empty
 * states + scrolling so each module's list view is just a row
 * renderer + a fetch fn. Used by pharmacy / lab / billing / bme /
 * facilities / housekeeping / security / hr drill-downs.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import { useFetch } from "../lib/use-fetch.js";
import { ScreenHeader } from "./screen-header.js";

export interface EntityListScreenProps<T> {
  eyebrow: string;
  title: string;
  description?: string;
  fetcher: () => Promise<T[]>;
  deps?: ReadonlyArray<unknown>;
  rowKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function EntityListScreen<T>(props: EntityListScreenProps<T>): ReactNode {
  const {
    eyebrow,
    title,
    description,
    fetcher,
    deps = [],
    rowKey,
    renderRow,
    emptyTitle = "Nothing yet",
    emptyDescription,
  } = props;
  const { data, loading, error, refetch } = useFetch(fetcher, deps);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader eyebrow={eyebrow} title={title} description={description} />
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title={`Couldn't load ${title.toLowerCase()}`}
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title={emptyTitle} description={emptyDescription} />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((item) => (
            <View key={rowKey(item)} style={{ marginBottom: SPACING.sm }}>
              {renderRow(item)}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
