import { Group, Text, Tooltip } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconClock,
  IconCloudFog,
  IconCloudRain,
  IconCloudSnow,
  IconCloudStorm,
  IconDroplet,
  IconSun,
  IconSunLow,
  type TablerIcon,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import styles from "./header-widgets.module.scss";
import { MyShiftWidget } from "./Nurse/MyShiftWidget";

/** Map a WMO weather code to a tabler icon, label, and a vivid colour. */
function weatherInfo(code: number): { Icon: TablerIcon; label: string; color: string } {
  if (code === 0) return { Icon: IconSun, label: "Clear", color: "#f1c21b" };
  if (code <= 3) return { Icon: IconSunLow, label: "Partly cloudy", color: "#d2a106" };
  if (code <= 48) return { Icon: IconCloudFog, label: "Fog", color: "#8d8d8d" };
  if (code <= 57) return { Icon: IconDroplet, label: "Drizzle", color: "#0072c3" };
  if (code <= 67) return { Icon: IconCloudRain, label: "Rain", color: "#0043ce" };
  if (code <= 77) return { Icon: IconCloudSnow, label: "Snow", color: "#33b1ff" };
  if (code <= 82) return { Icon: IconCloudRain, label: "Showers", color: "#0043ce" };
  if (code <= 86) return { Icon: IconCloudSnow, label: "Snow showers", color: "#33b1ff" };
  return { Icon: IconCloudStorm, label: "Thunderstorm", color: "#8a3ffc" };
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffectOnce(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  });
  return now;
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
        <IconClock size={15} className={styles.pulse} aria-hidden />
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

/**
 * The hospital's weather, fetched by the server for the hospital's own
 * location (RFC-OSINT §4) — staff browsers no longer send theirs. Shown only
 * while the reading is current; anything else hides the pill.
 */
function WeatherWidget() {
  const canView = useHasPermission(P.HEALTH.INTEL.VIEW);
  const { data } = useQuery({
    queryKey: ["health-intel", "environment"],
    queryFn: () => api.getHealthEnvironment(),
    enabled: canView,
    staleTime: 900_000,
    retry: false,
  });

  if (data?.status !== "current" || data.temperature_c === null || data.weather_code === null) {
    return null;
  }
  const { Icon, label, color } = weatherInfo(data.weather_code);
  const temp = Math.round(data.temperature_c);
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
      <MyShiftWidget />
      {/* Ambient, so the first to go when the bar is tight (zoom, small laptops). */}
      <Group gap="xs" wrap="nowrap" visibleFrom="xl">
        <ClockWidget />
        <WeatherWidget />
      </Group>
    </Group>
  );
}
