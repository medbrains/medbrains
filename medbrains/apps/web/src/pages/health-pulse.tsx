import { Group, Pagination, Stack, Tabs, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { BlogSection } from "@/components/HealthPulse/BlogSection";
import { Badge, Button, Drawer, Input, Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import styles from "./health-pulse.module.scss";

const TOPICS = [
  "Clinical medicine",
  "Surgery",
  "Nursing",
  "Pharmacy",
  "Radiology",
  "Laboratory",
  "Dentistry",
  "Health management",
  "Learning & education",
  "Health headlines",
] as const;

function formatDate(raw: string | null): string {
  if (!raw) return "";
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return "";
  return new Date(time).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** Health Pulse — search + read the ingested medical news feed. */
export function HealthPulsePage() {
  useRequirePermission(P.DASHBOARD.VIEW);
  const [topic, setTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<string | null>("news");
  const pageSize = 12;

  const { data: articles, isLoading } = useQuery({
    queryKey: ["news-feed", "center", topic, debounced],
    queryFn: () =>
      api.listNewsFeed({
        topic: topic ?? undefined,
        q: debounced.trim() || undefined,
        limit: 100,
      }),
    staleTime: 300_000,
  });

  // The same article can appear under several topics (shared feeds), so the
  // all-specialties view must dedupe by URL.
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return (articles ?? []).filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }, [articles]);

  const totalPages = Math.max(1, Math.ceil(deduped.length / pageSize));
  const pageItems = deduped.slice((page - 1) * pageSize, page * pageSize);
  const hero = pageItems[0];
  const secondary = pageItems.slice(1, 5);
  const latest = pageItems.slice(5);

  const { data: article } = useQuery({
    queryKey: ["news-feed", "article", openId],
    queryFn: () => api.getNewsFeedArticle(openId ?? ""),
    enabled: Boolean(openId),
  });

  return (
    <div className={styles.page}>
      <div className={styles.stickyHeader}>
        <PageHeader
          title="Health Pulse"
          subtitle="Live medical news, curated by specialty"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Health Pulse" }]}
        />

        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="news">News</Tabs.Tab>
            <Tabs.Tab value="blog">Our Blog</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {tab === "news" && (
          <Group gap="sm" wrap="wrap" mt="sm">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="Search articles…"
              leftSection={<Search size={15} />}
              style={{ flex: 1, minWidth: 220 }}
              aria-label="Search news"
            />
            <Select
              value={topic}
              onChange={(value) => {
                setTopic(value);
                setPage(1);
              }}
              data={TOPICS.map((value) => ({ value, label: value }))}
              placeholder="All specialties"
              clearable
              style={{ width: 220 }}
              aria-label="Filter by specialty"
            />
          </Group>
        )}
      </div>

      {tab === "blog" && <BlogSection />}

      {tab === "news" &&
        (isLoading ? (
          <Text c="dimmed" size="sm">
            Loading…
          </Text>
        ) : !articles?.length ? (
          <Text c="dimmed" size="sm">
            No articles found. Try a different search or specialty.
          </Text>
        ) : (
          <div className={styles.editorial}>
            {hero && (
              <button type="button" className={styles.hero} onClick={() => setOpenId(hero.id)}>
                <span className={styles.heroEyebrow}>
                  {hero.source} · {hero.topic}
                </span>
                <span className={styles.heroTitle}>{hero.title}</span>
                {hero.summary && <span className={styles.heroSummary}>{hero.summary}</span>}
                <span className={styles.meta}>{formatDate(hero.published_at)}</span>
              </button>
            )}

            {secondary.length > 0 && (
              <div className={styles.secondary}>
                {secondary.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={styles.secCard}
                    onClick={() => setOpenId(item.id)}
                  >
                    <span className={styles.eyebrow}>{item.source}</span>
                    <span className={styles.secTitle}>{item.title}</span>
                    <span className={styles.meta}>{formatDate(item.published_at)}</span>
                  </button>
                ))}
              </div>
            )}

            {latest.length > 0 && (
              <div className={styles.latest}>
                <span className={styles.sectionHead}>Latest</span>
                {latest.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={styles.latestRow}
                    onClick={() => setOpenId(item.id)}
                  >
                    <span className={styles.rank}>{String(index + 6).padStart(2, "0")}</span>
                    <span className={styles.latestBody}>
                      <span className={styles.eyebrow}>{item.source}</span>
                      <span className={styles.latestTitle}>{item.title}</span>
                    </span>
                    <span className={styles.meta}>{formatDate(item.published_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

      {tab === "news" && totalPages > 1 && (
        <div className={styles.pagerBar}>
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </div>
      )}

      <Drawer
        opened={Boolean(openId)}
        onClose={() => setOpenId(null)}
        position="right"
        size="lg"
        title="Article"
      >
        {article && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge tone="success">{article.topic}</Badge>
              <Text size="xs" c="dimmed">
                {article.source} · {formatDate(article.published_at)}
              </Text>
            </Group>
            <Text className={styles.readerTitle}>{article.title}</Text>
            <Text className={styles.readerBody}>{article.content ?? article.summary ?? ""}</Text>
            <Button
              component="a"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              tone="primary"
              rightSection={<ExternalLink size={14} aria-hidden />}
            >
              Read on {article.source}
            </Button>
          </Stack>
        )}
      </Drawer>
    </div>
  );
}
