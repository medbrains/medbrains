import { Text } from "@mantine/core";
import type { RecordAccess } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui";

interface AccessRow {
  access?: RecordAccess;
}

/**
 * Above a worklist: how many rows the access check could not answer (a fault,
 * so it is a warning and asks for a retry) and how many are outside the
 * caller's care (a fact, so it is a plain count).
 */
export function RecordAccessNotice({ rows }: { rows: AccessRow[] }) {
  const { t } = useTranslation("opd");
  const unchecked = rows.filter((row) => row.access === "unknown").length;
  const withheld = rows.filter((row) => row.access === "withheld").length;
  if (unchecked === 0 && withheld === 0) return null;
  return (
    <>
      {unchecked > 0 && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          {t("access.uncheckedNotice", {
            count: unchecked,
            defaultValue:
              "Couldn't check access for {{count}} rows, so their clinical details are hidden. Refresh to try again.",
          })}
        </Alert>
      )}
      {withheld > 0 && (
        <Text size="xs" c="dimmed">
          {t("access.withheldNotice", {
            count: withheld,
            defaultValue:
              "{{count}} rows are outside your care: their clinical details are hidden.",
          })}
        </Text>
      )}
    </>
  );
}
