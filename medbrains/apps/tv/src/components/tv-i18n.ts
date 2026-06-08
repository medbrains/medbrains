import type { TokenBoardSurfaceId } from "@medbrains/types";

type TvTextValues = Record<string, string | number | boolean>;

export const TV_TEXT = {
  feed: {
    degradedTitle: "tv.feed.degradedTitle",
    lastSync: "tv.feed.lastSync",
    legend: "tv.feed.legend",
    notSynced: "tv.feed.notSynced",
    reconnecting: "tv.feed.reconnecting",
    statusTitle: "tv.feed.statusTitle",
  },
  privacy: {
    displayMode: "tv.privacy.displayMode",
  },
  tokenBoards: {
    feedError: {
      billing: "tv.tokenBoards.feedError.billing",
      emergency: "tv.tokenBoards.feedError.emergency",
      lab: "tv.tokenBoards.feedError.lab",
      opd: "tv.tokenBoards.feedError.opd",
      pharmacy: "tv.tokenBoards.feedError.pharmacy",
      radiology: "tv.tokenBoards.feedError.radiology",
    },
  },
} as const;

const TV_MESSAGES: Readonly<Record<string, string>> = {
  "tv.feed.degradedTitle": "Feed degraded",
  "tv.feed.lastSync": "Last sync {{time}}",
  "tv.feed.legend": "Updates every {{refresh}} · last sync {{sync}} · {{deepLink}}",
  "tv.feed.notSynced": "not synced",
  "tv.feed.reconnecting": "Showing last known tokens while the display reconnects.",
  "tv.feed.statusTitle": "Feed status",
  "tv.privacy.displayMode": "Privacy display mode",
  "tv.tokenBoards.feedError.billing":
    "Billing queue feed is unreachable. Continuing with the last available token state.",
  "tv.tokenBoards.feedError.emergency":
    "Emergency triage feed is unreachable. Continuing with the last available token state.",
  "tv.tokenBoards.feedError.lab":
    "Lab collection feed is unreachable. Continuing with the last available token state.",
  "tv.tokenBoards.feedError.opd":
    "Queue feed is unreachable. Continuing with the last available token state.",
  "tv.tokenBoards.feedError.pharmacy":
    "Pharmacy queue feed is unreachable. Continuing with the last available token state.",
  "tv.tokenBoards.feedError.radiology":
    "Radiology queue feed is unreachable. Continuing with the last available token state.",
};

function interpolate(template: string, values?: TvTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function tvText(key: string, values?: TvTextValues): string {
  return interpolate(TV_MESSAGES[key] ?? key, values);
}

export function tvTokenBoardFeedErrorLabel(surfaceId: TokenBoardSurfaceId): string {
  return tvText(TV_TEXT.tokenBoards.feedError[surfaceId]);
}
