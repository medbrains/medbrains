import { HoverCard, Text } from "@mantine/core";
import { useFocusWithin, useHover, useInterval, useMergedRef } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { NewsFeedArticle } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import { Button } from "@/components/ui";
import { type NewsSource, newsForRole } from "@/config/medical-news-sources";
import styles from "./news-marquee.module.scss";

interface Headline {
  title: string;
  link: string;
  description?: string;
  date?: string;
}

/** Format an ISO date to a readable, separate date label. */
function formatDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function articleToHeadline(article: NewsFeedArticle): Headline {
  return {
    title: article.title,
    link: article.url,
    description: article.summary ?? undefined,
    date: formatDate(article.published_at),
  };
}

function sourcesAsHeadlines(sources: NewsSource[]): Headline[] {
  return sources.map((source) => ({ title: source.name, link: source.url }));
}

/** Readable host for the card footer, e.g. "medlineplus.gov". */
function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const ROTATE_MS = 3200;

/**
 * Header news ticker — a role-aware, vertical fold rotator that cycles live
 * medical articles one at a time. Articles come from the backend news-feed API
 * (ingested into news_feed_articles), with the curated free-source list as a
 * fallback only if the feed is empty. Pauses on hover/focus; reduced-motion safe.
 */
export function NewsMarquee() {
  const role = useAuthStore((s) => s.user?.role);
  const news = newsForRole(role);

  const { data } = useQuery({
    queryKey: ["news-feed", news.topic],
    queryFn: () => api.listNewsFeed({ topic: news.topic, limit: 15 }),
    staleTime: 600_000,
    retry: 1,
  });

  const articles = (data ?? []).map(articleToHeadline);
  const headlines = articles.length > 0 ? articles : sourcesAsHeadlines(news.sources);
  const [index, setIndex] = useState(0);

  // Pause rotation while reading (hover) or tabbed in (focus).
  const { hovered, ref: hoverRef } = useHover<HTMLElement>();
  const { focused, ref: focusRef } = useFocusWithin<HTMLElement>();
  const sectionRef = useMergedRef(hoverRef, focusRef);

  const rotation = useInterval(() => {
    if (hovered || focused) return;
    setIndex((current) => (current + 1) % Math.max(headlines.length, 1));
  }, ROTATE_MS);
  useEffectOnce(() => {
    rotation.start();
    return rotation.stop;
  });

  const item = headlines[index % headlines.length];
  if (!item) return null;
  const host = hostnameOf(item.link);

  return (
    <section ref={sectionRef} className={styles.marquee} aria-label={`${news.topic} news`}>
      <div className={styles.stage} aria-live="polite">
        <HoverCard
          width={360}
          shadow="md"
          radius="md"
          position="bottom-start"
          openDelay={200}
          closeDelay={80}
          withinPortal
        >
          <HoverCard.Target>
            {/* key forces a remount each change so the fold-in animation replays */}
            <a
              key={index}
              className={styles.fold}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.title}
            >
              <span className={styles.dot} aria-hidden />
              <span className={styles.title}>{item.title}</span>
            </a>
          </HoverCard.Target>
          <HoverCard.Dropdown className={styles.card}>
            {item.date && (
              <>
                <span className={styles.cardDate}>{item.date}</span>
                <div className={styles.cardDivider} />
              </>
            )}
            <Text className={styles.cardTitle}>{item.title}</Text>
            {item.description && <Text className={styles.cardDesc}>{item.description}</Text>}
            <div className={styles.cardDivider} />
            <Button
              component="a"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              tone="primary"
              size="xs"
              rightSection={<ExternalLink size={13} aria-hidden />}
            >
              {host ? `Read more on ${host}` : "Read full article"}
            </Button>
          </HoverCard.Dropdown>
        </HoverCard>
      </div>
    </section>
  );
}
