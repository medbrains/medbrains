/**
 * Mobile DataTable — flat list of rows with column-key-based
 * rendering. Mirrors the web DataTable's Column contract:
 *   - `key` + `label` + `render` (NOT accessor + title)
 *   - `data` prop (NOT records)
 *   - `loading` prop (NOT isLoading)
 *   - `rowKey` required
 */

import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { COLORS, SPACING } from "../tokens.js";
import { Empty } from "./empty.js";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: number;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  data: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowPress?: (row: T) => void;
}

export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const {
    columns,
    data,
    rowKey,
    loading = false,
    emptyTitle = "Nothing here yet",
    emptyDescription,
    onRowPress,
  } = props;

  if (loading) {
    return (
      <View style={{ padding: SPACING.lg, alignItems: "center" }}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  if (data.length === 0) {
    return <Empty title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "column" }}>
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: COLORS.rule,
            paddingVertical: SPACING.sm,
            paddingHorizontal: SPACING.md,
            backgroundColor: COLORS.panel,
          }}
        >
          {columns.map((col) => (
            <View key={col.key} style={{ width: col.width ?? 140 }}>
              <Text
                variant="labelSmall"
                style={{
                  color: COLORS.brandDeep,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                  fontFamily: "JetBrainsMono-Regular",
                }}
              >
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {data.map((row) => {
          const key = rowKey(row);
          return (
            <View
              key={key}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1,
                borderBottomColor: COLORS.rule,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                backgroundColor: COLORS.canvas,
              }}
              onTouchEnd={onRowPress ? () => onRowPress(row) : undefined}
            >
              {columns.map((col) => (
                <View key={col.key} style={{ width: col.width ?? 140 }}>
                  {col.render(row)}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
