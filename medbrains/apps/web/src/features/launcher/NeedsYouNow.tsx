import { Anchor, Group, Stack, Text } from "@mantine/core";
import type { WorkDetail, WorkItem } from "@medbrains/types";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Alert } from "@/components/ui";
import { countLabel, minutesSince } from "./workModel";

type CriticalDetail = Extract<WorkDetail, { kind: "critical_result" }>;

/** The oldest critical value in words, naming the patient only when the server did. */
function CriticalLine({ detail }: { detail: CriticalDetail }) {
  const { t } = useTranslation("nav");
  const minutes = minutesSince(detail.reported_at, Date.now());
  const values = {
    parameter: detail.parameter,
    value: [detail.value, detail.unit].filter(Boolean).join(" "),
    ago: minutes < 1 ? t("workAgoNow") : t("workAgo", { count: minutes }),
    name: detail.patient?.name,
    uhid: detail.patient?.uhid,
  };
  return (
    <Trans
      t={t}
      i18nKey={detail.patient ? "workCriticalLineNamed" : "workCriticalLine"}
      values={values}
      components={{ b: <Text span fw={600} />, mono: <Text span ff="monospace" /> }}
    />
  );
}

/**
 * One safety item as a slim danger strip, in words as well as colour. A failed read stays here
 * and tells the person to check, so an outage never reads as "nothing critical".
 */
function CriticalStrip({ item }: { item: WorkItem }) {
  const { t } = useTranslation("nav");
  const failed = item.status === "failed";
  const detail = item.detail?.kind === "critical_result" ? item.detail : undefined;
  const title = failed
    ? t("workCriticalFailedTitle")
    : t("workCriticalTitle", { count: item.count ?? 0, shown: countLabel(item) });
  return (
    <Alert tone="danger" role="alert" py="xs">
      <Group justify="space-between" align="center" gap="sm">
        <Text size="sm">
          <Text span fw={600}>
            {title}
          </Text>{" "}
          {failed ? t("workCriticalFailed") : detail && <CriticalLine detail={detail} />}
        </Text>
        <Anchor component={Link} to={item.href} fw={500} size="sm" mih={24}>
          {t(failed ? "workCriticalOpenInbox" : "workCriticalOpen")}
        </Anchor>
      </Group>
    </Alert>
  );
}

/** "Needs you now": safety items in a slim strip above everything; nothing when there are none. */
export function NeedsYouNow({ items }: { items: readonly WorkItem[] }) {
  const { t } = useTranslation("nav");
  if (items.length === 0) return null;
  return (
    <Stack gap="xs" component="section" aria-label={t("workNowTitle")}>
      {items.map((item) => (
        <CriticalStrip key={item.key} item={item} />
      ))}
    </Stack>
  );
}
