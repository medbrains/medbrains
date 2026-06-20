import { HoverCard, Text } from "@mantine/core";
import { useFocusWithin, useHover, useInterval, useMergedRef } from "@mantine/hooks";
import { useAuthStore } from "@medbrains/stores";
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

interface Rss2JsonResponse {
  status: string;
  items?: { title: string; link: string; description?: string; pubDate?: string }[];
}

/** Format an RSS pubDate to a readable, separate date label. */
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

/** Strip HTML tags + collapse whitespace from a feed snippet for the tooltip. */
function cleanSnippet(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

/** Parse an RSS XML string into headlines (fallback proxy path). */
function parseRssXml(xml: string): Headline[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.querySelectorAll("item"))
    .slice(0, 12)
    .map((node) => ({
      title: node.querySelector("title")?.textContent?.trim() ?? "",
      link: node.querySelector("link")?.textContent?.trim() ?? "",
      description: cleanSnippet(node.querySelector("description")?.textContent),
      date: formatDate(node.querySelector("pubDate")?.textContent),
    }))
    .filter((item) => item.title && item.link);
}

/** Fetch live, direct article headlines — rss2json first, allorigins fallback. */
async function fetchHeadlines(feedUrl: string): Promise<Headline[]> {
  const encoded = encodeURIComponent(feedUrl);
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encoded}&count=12`);
    if (res.ok) {
      const json: Rss2JsonResponse = await res.json();
      if (json.status === "ok" && json.items?.length) {
        return json.items.map((item) => ({
          title: item.title,
          link: item.link,
          description: cleanSnippet(item.description),
          date: formatDate(item.pubDate),
        }));
      }
    }
  } catch {
    // proxy unreachable — fall through to the raw-XML proxy below
  }
  const res = await fetch(`https://api.allorigins.win/raw?url=${encoded}`);
  if (!res.ok) throw new Error("news feed unavailable");
  const items = parseRssXml(await res.text());
  if (!items.length) throw new Error("news feed empty");
  return items;
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
 * Header news ticker — a role-aware, vertical fold rotator that cycles live,
 * direct medical articles one at a time (curated free-magazine fallback only if
 * all feeds fail). Each article folds in from the top; pauses on hover/focus
 * (Mantine hooks); honours reduced-motion; each item links out to the article.
 */
export function NewsMarquee() {
  const role = useAuthStore((s) => s.user?.role);
  const news = newsForRole(role);

  const { data } = useQuery({
    queryKey: ["medical-news", news.topic],
    queryFn: () => fetchHeadlines(news.feedUrl),
    staleTime: 1_800_000,
    retry: 1,
  });

  // The marquee itself cycles everything: live articles first, then the
  // curated free sources for this role (sources are always present).
  const headlines = [...(data ?? []), ...sourcesAsHeadlines(news.sources)];
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
