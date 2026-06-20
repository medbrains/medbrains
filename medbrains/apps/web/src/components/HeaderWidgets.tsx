import { Group, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Clock, Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudSun, Sun, Zap } from "lucide-react";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import styles from "./header-widgets.module.scss";

// Fallback location until the browser grants geolocation (Chennai).
const FALLBACK = { lat: 13.0827, lon: 80.2707 };

interface WeatherNow {
  current: { temperature_2m: number; weather_code: number };
}

/** Map a WMO weather code to a lucide icon, label, and a vivid colour. */
function weatherInfo(code: number): { Icon: LucideIcon; label: string; color: string } {
  if (code === 0) return { Icon: Sun, label: "Clear", color: "#f1c21b" };
  if (code <= 3) return { Icon: CloudSun, label: "Partly cloudy", color: "#d2a106" };
  if (code <= 48) return { Icon: Cloud, label: "Fog", color: "#8d8d8d" };
  if (code <= 57) return { Icon: CloudDrizzle, label: "Drizzle", color: "#0072c3" };
  if (code <= 67) return { Icon: CloudRain, label: "Rain", color: "#0043ce" };
  if (code <= 77) return { Icon: CloudSnow, label: "Snow", color: "#33b1ff" };
  if (code <= 82) return { Icon: CloudRain, label: "Showers", color: "#0043ce" };
  if (code <= 86) return { Icon: CloudSnow, label: "Snow showers", color: "#33b1ff" };
  return { Icon: Zap, label: "Thunderstorm", color: "#8a3ffc" };
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
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return (
    <Tooltip label={now.toLocaleDateString([], { dateStyle: "full" })} withArrow>
      <Group gap={6} wrap="nowrap" className={`${styles.pill} ${styles.pillClock}`}>
        <Clock size={15} className={styles.pulse} aria-hidden />
        <Text size="xs" fw={700} ff="var(--mb-font-mono)" className={styles.clockTime}>
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
  const { Icon, label, color } = weatherInfo(data.current.weather_code);
  const temp = Math.round(data.current.temperature_2m);
  return (
    <Tooltip label={`${label} · ${temp}°C`} withArrow>
      <Group
        gap={6}
        wrap="nowrap"
        className={styles.pill}
        style={{ background: `${color}1f`, borderColor: `${color}55` }}
      >
        <Icon size={15} color={color} aria-hidden />
        <Text size="xs" fw={700} style={{ color }}>
          {temp}°
        </Text>
      </Group>
    </Tooltip>
  );
}

/** Header utility cluster — colourful live clock + live weather. */
export function HeaderWidgets() {
  return (
    <Group gap="xs" wrap="nowrap" visibleFrom="lg">
      <ClockWidget />
      <WeatherWidget />
    </Group>
  );
}
