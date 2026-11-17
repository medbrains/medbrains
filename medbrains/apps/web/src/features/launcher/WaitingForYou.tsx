import { Group, SimpleGrid, Skeleton, Stack, Text, UnstyledButton } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import type { WorkItem } from "@medbrains/types";
import { IconCloudOff } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Card, ModuleBadge } from "@/components/ui";
import { getModuleBadge, resolveIcon } from "@/config/navigation";
import { LauncherSection } from "./LauncherSection";
import styles from "./launcher.module.scss";
import { countLabel, dayAndTime, type useMyWork, waitingState } from "./workModel";

/** One card on a phone, two on a tablet, three on a laptop beside the side panel, four wider. */
const WORK_COLS = { base: 1, xs: 2, lg: 3, xl: 4 };
/** Each item's name, and the icon its card shows when its screen has no module mark. */
const ITEM_COPY: Record<WorkItem["key"], { label: string; icon: string }> = {
  lab_critical: { label: "workLabCritical", icon: "IconAlertTriangle" },
  opd_waiting: { label: "workOpdWaiting", icon: "IconStethoscope" },
  notes_unsigned: { label: "workNotesUnsigned", icon: "IconSignature" },
  approvals: { label: "workApprovals", icon: "IconChecklist" },
};

/** The one detail line under a count, worded from the server's typed value. */
function detailLine(item: WorkItem, t: TFunction<"nav">, lang: string) {
  const d = item.detail;
  if (!d) return undefined;
  if (d.kind === "queue_wait") return t("workLongestWait", { count: d.longest_minutes });
  if (d.kind === "oldest_at")
    return t("workOldestFrom", { when: dayAndTime(d.at, new Date(), lang) });
  if (d.kind === "soonest_due")
    return t("workNextDue", { when: dayAndTime(d.at, new Date(), lang) });
  return undefined;
}

/** One item as a card linking to its screen: count, one detail line, and a warning chip. */
function WorkCard({ item }: { item: WorkItem }) {
  const { t, i18n } = useTranslation("nav");
  const copy = ITEM_COPY[item.key];
  const badge = getModuleBadge(item.href);
  const count = countLabel(item);
  const longWaits = item.detail?.kind === "queue_wait" ? item.detail : undefined;
  const line = detailLine(item, t, i18n.language);
  return (
    <Card p={0} pattern={false}>
      <UnstyledButton component={Link} to={item.href} className={styles.workLink}>
        <Stack gap="xs">
          <Group gap="sm" wrap="nowrap" preventGrowOverflow={false}>
            {badge ? (
              <ModuleBadge abbr={badge.abbr} color={badge.color} size={32} />
            ) : (
              resolveIcon(copy.icon, 32, 1.5)
            )}
            <Text fw={600} lineClamp={2} flex={1}>
              {t(copy.label)}
            </Text>
            {count ? (
              <Text fz="h2" fw={500} lh={1}>
                {count}
              </Text>
            ) : (
              <Group gap={4} wrap="nowrap">
                <IconCloudOff size={16} aria-hidden />
                <Text size="sm">{t("workDidntLoad")}</Text>
              </Group>
            )}
          </Group>
          {line && (
            <Text size="sm" c="dimmed">
              {line}
            </Text>
          )}
          {longWaits && longWaits.long_waits > 0 && (
            <Group>
              <Badge tone="warning">
                {t("workLongWaits", {
                  count: longWaits.long_waits,
                  minutes: longWaits.long_wait_minutes,
                })}
              </Badge>
            </Group>
          )}
        </Stack>
      </UnstyledButton>
    </Card>
  );
}

/**
 * "Waiting for you": a card per item with something in it. Loading shows skeletons, a failed
 * request says so, and "Nothing waiting for you" appears only when every item loaded at 0.
 */
export function WaitingForYou({
  work,
  items,
}: {
  work: ReturnType<typeof useMyWork>;
  items: WorkItem[];
}) {
  const { t } = useTranslation("nav");
  const reduceMotion = useReducedMotion();
  const section = (body: React.ReactNode) => (
    <LauncherSection title={t("workWaitingTitle")} why={t("workWaitingWhy")}>
      {body}
    </LauncherSection>
  );
  if (work.isError) {
    return section(
      <QueryError
        error={work.error}
        onRetry={() => void work.refetch()}
        title={t("workLoadFailed")}
      />,
    );
  }
  if (work.isPending) {
    return section(
      <SimpleGrid cols={WORK_COLS} aria-busy="true" aria-label={t("workLoading")}>
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} height={104} animate={!reduceMotion} />
        ))}
      </SimpleGrid>,
    );
  }
  const state = waitingState(items);
  if (state.kind === "hidden") return null;
  if (state.kind === "nothing") return section(<Text c="dimmed">{t("workNothing")}</Text>);
  return section(
    <Stack gap="sm" align="flex-start">
      <SimpleGrid cols={WORK_COLS} w="100%">
        {state.items.map((item) => (
          <WorkCard key={item.key} item={item} />
        ))}
      </SimpleGrid>
      {state.anyFailed && (
        <Button tone="secondary" loading={work.isFetching} onClick={() => void work.refetch()}>
          {t("workTryAgain")}
        </Button>
      )}
    </Stack>,
  );
}
