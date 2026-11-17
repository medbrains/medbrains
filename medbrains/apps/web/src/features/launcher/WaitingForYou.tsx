import { Group, SimpleGrid, Skeleton, Stack, Text, UnstyledButton } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import type { WorkItem } from "@medbrains/types";
import { IconCloudOff } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Card } from "@/components/ui";
import { LauncherSection } from "./LauncherSection";
import styles from "./launcher.module.scss";
import { countLabel, dayAndTime, minutesSince, type useMyWork, waitingState } from "./workModel";

/** Four equal cards on a desktop, as on the board; two on a tablet, one on a phone. */
const WORK_COLS = { base: 1, xs: 2, md: 4 };
/** Each item's name on its card. */
const ITEM_LABEL: Record<WorkItem["key"], string> = {
  lab_critical: "workLabCritical",
  opd_waiting: "workOpdWaiting",
  notes_unsigned: "workNotesUnsigned",
  approvals: "workApprovals",
};

/** The one muted line under a card's name, worded from the server's typed value. */
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

/** One item as on the board: the big number, the name, one muted line; the card is a link. */
function WorkCard({ item }: { item: WorkItem }) {
  const { t, i18n } = useTranslation("nav");
  const count = countLabel(item);
  const line = detailLine(item, t, i18n.language);
  const longWaits = item.detail?.kind === "queue_wait" ? item.detail : undefined;
  return (
    <Card p={0} pattern={false}>
      <UnstyledButton component={Link} to={item.href} className={styles.workLink}>
        {count ? (
          <Text fz={36} fw={600} lh={1.1} ff="var(--mb-font-display)">
            {count}
          </Text>
        ) : (
          <Group gap="xs" wrap="nowrap" mih={40}>
            <IconCloudOff size={20} aria-hidden />
            <Text fw={600}>{t("workDidntLoad")}</Text>
          </Group>
        )}
        <Text fw={500}>{t(ITEM_LABEL[item.key])}</Text>
        {(line || longWaits) && (
          <Group gap="xs">
            {line && (
              <Text size="sm" c="dimmed">
                {line}
              </Text>
            )}
            {longWaits && longWaits.long_waits > 0 && (
              <Badge tone="warning" size="xs">
                {t("workLongWaits", {
                  count: longWaits.long_waits,
                  minutes: longWaits.long_wait_minutes,
                })}
              </Badge>
            )}
          </Group>
        )}
      </UnstyledButton>
    </Card>
  );
}

/** "Across your apps · updated a moment ago", or how many minutes ago. */
function updatedLine(minutes: number, t: TFunction<"nav">) {
  return minutes < 1 ? t("workUpdatedNow") : t("workUpdated", { count: minutes });
}

/** The cards, or the one line that says nothing is waiting; a retry when any card failed. */
function WorkBody({ work, items }: WaitingForYouProps) {
  const { t } = useTranslation("nav");
  const state = waitingState(items);
  if (state.kind === "nothing") return <Text c="dimmed">{t("workNothing")}</Text>;
  if (state.kind !== "items") return null;
  return (
    <Stack gap="md" align="flex-start">
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
    </Stack>
  );
}

interface WaitingForYouProps {
  work: ReturnType<typeof useMyWork>;
  items: WorkItem[];
}

/**
 * "Waiting for you", the page heading. Loading shows skeletons, a failed request says so, and
 * "Nothing waiting for you" appears only when every item loaded at 0. Someone with no items
 * at all (a billing clerk, say) gets no section.
 */
export function WaitingForYou({ work, items }: WaitingForYouProps) {
  const { t } = useTranslation("nav");
  const reduceMotion = useReducedMotion();
  if (work.isSuccess && waitingState(items).kind === "hidden") return null;
  const minutes = minutesSince(new Date(work.dataUpdatedAt).toISOString(), Date.now());
  const updated = work.isSuccess ? updatedLine(minutes, t) : undefined;
  return (
    <LauncherSection title={t("workWaitingTitle")} isPageHeading aside={updated}>
      {work.isError ? (
        <QueryError
          error={work.error}
          onRetry={() => void work.refetch()}
          title={t("workLoadFailed")}
        />
      ) : work.isPending ? (
        <SimpleGrid cols={WORK_COLS} aria-busy="true" aria-label={t("workLoading")}>
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} height={128} animate={!reduceMotion} />
          ))}
        </SimpleGrid>
      ) : (
        <WorkBody work={work} items={items} />
      )}
    </LauncherSection>
  );
}
