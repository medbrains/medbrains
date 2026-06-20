import { ActionIcon, Group, Menu, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudSun,
  ExternalLink,
  Newspaper,
  Sun,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useEffectOnce } from "react-use";

// Fallback location until the browser grants geolocation (Chennai).
const FALLBACK = { lat: 13.0827, lon: 80.2707 };

// Curated medical news + reference links (open in a new tab).
const NEWS_LINKS: { label: string; note: string; url: string }[] = [
  { label: "WHO — News", note: "Global health alerts", url: "https://www.who.int/news" },
  { label: "MoHFW India", note: "Ministry advisories", url: "https://www.mohfw.gov.in" },
  { label: "ICMR", note: "Indian research council", url: "https://www.icmr.gov.in" },
  { label: "The Lancet", note: "Peer-reviewed journal", url: "https://www.thelancet.com" },
  { label: "BMJ", note: "British Medical Journal", url: "https://www.bmj.com/latest" },
  { label: "Medscape", note: "Clinical news", url: "https://www.medscape.com/news" },
  { label: "PubMed", note: "Literature search", url: "https://pubmed.ncbi.nlm.nih.gov" },
];

interface WeatherNow {
  current: { temperature_2m: number; weather_code: number };
}

/** Map a WMO weather code to a lucide icon + short label. */
function weatherInfo(code: number): { Icon: LucideIcon; label: string } {
  if (code === 0) return { Icon: Sun, label: "Clear" };
  if (code <= 3) return { Icon: CloudSun, label: "Partly cloudy" };
  if (code <= 48) return { Icon: Cloud, label: "Fog" };
  if (code <= 57) return { Icon: CloudDrizzle, label: "Drizzle" };
  if (code <= 67) return { Icon: CloudRain, label: "Rain" };
  if (code <= 77) return { Icon: CloudSnow, label: "Snow" };
  if (code <= 82) return { Icon: CloudRain, label: "Showers" };
  if (code <= 86) return { Icon: CloudSnow, label: "Snow showers" };
  return { Icon: Zap, label: "Thunderstorm" };
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffectOnce(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  });
  return now;
}

function useCoords(): { lat: number; lon: number } {
  const [coords, setCoords] = useState(FALLBACK);
  useEffectOnce(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // denied/unavailable — keep fallback
      { timeout: 6000, maximumAge: 1_800_000 },
    );
  });
  return coords;
}

function ClockWidget() {
  const now = useClock();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return (
    <Tooltip label={now.toLocaleDateString([], { dateStyle: "full" })} withArrow>
      <Group gap={6} wrap="nowrap">
        <Clock size={15} color="var(--mb-text-secondary)" aria-hidden />
        <Text size="xs" fw={600} c="var(--mb-text-primary)" ff="var(--mb-font-mono)">
          {time}
        </Text>
        <Text size="xs" c="var(--mb-text-muted)" visibleFrom="xl">
          {date}
        </Text>
      </Group>
    </Tooltip>
  );
}

function WeatherWidget() {
  const { lat, lon } = useCoords();
  const { data } = useQuery({
    queryKey: ["weather", lat.toFixed(2), lon.toFixed(2)],
    queryFn: async (): Promise<WeatherNow> => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("weather unavailable");
      return res.json();
    },
    staleTime: 1_800_000,
    retry: 1,
  });

  if (!data?.current) return null;
  const { Icon, label } = weatherInfo(data.current.weather_code);
  const temp = Math.round(data.current.temperature_2m);
  return (
    <Tooltip label={`${label} · ${temp}°C`} withArrow>
      <Group gap={6} wrap="nowrap">
        <Icon size={15} color="var(--mb-interactive)" aria-hidden />
        <Text size="xs" fw={600} c="var(--mb-text-primary)">
          {temp}°
        </Text>
      </Group>
    </Tooltip>
  );
}

function NewsMenu() {
  return (
    <Menu shadow="md" width={248} position="bottom-end">
      <Menu.Target>
        <Tooltip label="Medical news" withArrow>
          <ActionIcon size="md" color="slate" variant="subtle" aria-label="Medical news">
            <Newspaper size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Medical news &amp; references</Menu.Label>
        {NEWS_LINKS.map((link) => (
          <Menu.Item
            key={link.url}
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            rightSection={<ExternalLink size={12} color="var(--mb-text-muted)" />}
          >
            <Text size="sm" fw={500}>
              {link.label}
            </Text>
            <Text size="xs" c="dimmed">
              {link.note}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** Header utility cluster — live clock, live weather, and a medical-news menu. */
export function HeaderWidgets() {
  return (
    <Group gap="md" wrap="nowrap">
      <Group gap="md" wrap="nowrap" visibleFrom="lg">
        <ClockWidget />
        <WeatherWidget />
      </Group>
      <NewsMenu />
    </Group>
  );
}
