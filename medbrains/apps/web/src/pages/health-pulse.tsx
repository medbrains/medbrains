import { Group, Pagination, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Badge, Button, Card, Drawer, Input, Select } from "@/components/ui";
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

  const totalPages = Math.max(1, Math.ceil((articles?.length ?? 0) / pageSize));
  const pageItems = (articles ?? []).slice((page - 1) * pageSize, page * pageSize);

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

        <Group gap="sm" wrap="wrap">
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
      </div>

      {isLoading ? (
        <Text c="dimmed" size="sm">
          Loading…
        </Text>
      ) : !articles?.length ? (
        <Text c="dimmed" size="sm">
          No articles found. Try a different search or specialty.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {pageItems.map((item) => (
            <Card
              key={item.id}
              withBorder
              className={styles.card}
              onClick={() => setOpenId(item.id)}
            >
              <Group justify="space-between" gap="xs" mb={6}>
                <span className={styles.source}>{item.source}</span>
                <Text size="xs" c="dimmed">
                  {formatDate(item.published_at)}
                </Text>
              </Group>
              <Text className={styles.cardTitle}>{item.title}</Text>
              {item.summary && (
                <Text size="sm" c="dimmed" lineClamp={3} mt={6}>
                  {item.summary}
                </Text>
              )}
              <Badge tone="success" mt="sm">
                {item.topic}
              </Badge>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {totalPages > 1 && (
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
