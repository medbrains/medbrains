import { useFocusWithin, useHover, useInterval, useMergedRef } from "@mantine/hooks";
import { useAuthStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import { type NewsSource, newsForRole } from "@/config/medical-news-sources";
import styles from "./news-marquee.module.scss";

interface Headline {
  title: string;
  link: string;
}

interface Rss2JsonResponse {
  status: string;
  items?: { title: string; link: string }[];
}

/** Parse an RSS XML string into headlines (fallback proxy path). */
function parseRssXml(xml: string): Headline[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.querySelectorAll("item"))
    .slice(0, 12)
    .map((node) => ({
      title: node.querySelector("title")?.textContent?.trim() ?? "",
      link: node.querySelector("link")?.textContent?.trim() ?? "",
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
        return json.items.map((item) => ({ title: item.title, link: item.link }));
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

  const headlines = data ?? sourcesAsHeadlines(news.sources);
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

  return (
    <section ref={sectionRef} className={styles.marquee} aria-label={`${news.topic} news`}>
      <div className={styles.topic}>
        <Newspaper size={13} aria-hidden />
        <span>{news.topic}</span>
      </div>
      <div className={styles.stage} aria-live="polite">
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
      </div>
    </section>
  );
}
