import type { BillingQueueLaneKey, TokenBoardSurfaceId } from "@medbrains/types";

type TvTextValues = Record<string, string | number | boolean>;
export type TvBedStatusReadinessKey = "privacy" | "refresh" | "ward";
export type TvBedStatusSummaryKey = "available" | "occupied" | "total" | "waiting";
export type TvTokenBoardScope = "department" | "hospital";
export type TvTokenBoardSummaryKey =
  | "avgScan"
  | "avgWait"
  | "bays"
  | "collected"
  | "completed"
  | "modality"
  | "now"
  | "nowServing"
  | "orange"
  | "ready"
  | "red"
  | "scope"
  | "total"
  | "waiting";
export type TvTokenBoardLaneKey =
  | BillingQueueLaneKey
  | "calledNow"
  | "collectingNow"
  | "inProgress"
  | "nextTokens"
  | "nowServing"
  | "preparing"
  | "readyPickup"
  | "waiting"
  | "waitingSamples"
  | "waitingScans";
export type TvTriageLaneKey = "blue" | "green" | "orange" | "red" | "yellow";

export const TV_TEXT = {
  bedStatus: {
    availableLegend: "tv.bedStatus.availableLegend",
    displayName: "tv.bedStatus.displayName",
    emptyWaiting: "tv.bedStatus.emptyWaiting",
    eyebrow: "tv.bedStatus.eyebrow",
    feedError: "tv.bedStatus.feedError",
    loading: "tv.bedStatus.loading",
    occupancyTitle: "tv.bedStatus.occupancyTitle",
    occupiedLegend: "tv.bedStatus.occupiedLegend",
    privacyNotice: "tv.bedStatus.privacyNotice",
    readiness: {
      privacy: {
        label: "tv.bedStatus.readiness.privacy.label",
        value: "tv.bedStatus.readiness.privacy.value",
      },
      refresh: {
        label: "tv.bedStatus.readiness.refresh.label",
        value: "tv.bedStatus.readiness.refresh.value",
      },
      ward: {
        label: "tv.bedStatus.readiness.ward.label",
      },
    },
    subtitle: "tv.bedStatus.subtitle",
    summary: {
      available: "tv.bedStatus.summary.available",
      occupied: "tv.bedStatus.summary.occupied",
      total: "tv.bedStatus.summary.total",
      waiting: "tv.bedStatus.summary.waiting",
    },
    title: "tv.bedStatus.title",
    unavailableMessage: "tv.bedStatus.unavailableMessage",
    unavailableTitle: "tv.bedStatus.unavailableTitle",
    waitingCase: "tv.bedStatus.waitingCase",
    waitingLaneTitle: "tv.bedStatus.waitingLaneTitle",
    waitMinutes: "tv.bedStatus.waitMinutes",
  },
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
    laneEmpty: {
      advance_deposit: "tv.tokenBoards.laneEmpty.billing.advanceDeposit",
      calledNow: "tv.tokenBoards.laneEmpty.calledNow",
      collectingNow: "tv.tokenBoards.laneEmpty.collectingNow",
      inProgress: "tv.tokenBoards.laneEmpty.inProgress",
      insurance_desk: "tv.tokenBoards.laneEmpty.billing.insuranceDesk",
      ipd_discharge: "tv.tokenBoards.laneEmpty.billing.ipdDischarge",
      nextTokens: "tv.tokenBoards.laneEmpty.nextTokens",
      nowServing: "tv.tokenBoards.laneEmpty.nowServing",
      opd_billing: "tv.tokenBoards.laneEmpty.billing.opdBilling",
      preparing: "tv.tokenBoards.laneEmpty.preparing",
      readyPickup: "tv.tokenBoards.laneEmpty.readyPickup",
      waiting: "tv.tokenBoards.laneEmpty.waiting",
      waitingSamples: "tv.tokenBoards.laneEmpty.waitingSamples",
      waitingScans: "tv.tokenBoards.laneEmpty.waitingScans",
    },
    laneTitle: {
      advance_deposit: "tv.tokenBoards.laneTitle.billing.advanceDeposit",
      calledNow: "tv.tokenBoards.laneTitle.calledNow",
      collectingNow: "tv.tokenBoards.laneTitle.collectingNow",
      inProgress: "tv.tokenBoards.laneTitle.inProgress",
      insurance_desk: "tv.tokenBoards.laneTitle.billing.insuranceDesk",
      ipd_discharge: "tv.tokenBoards.laneTitle.billing.ipdDischarge",
      nextTokens: "tv.tokenBoards.laneTitle.nextTokens",
      nowServing: "tv.tokenBoards.laneTitle.nowServing",
      opd_billing: "tv.tokenBoards.laneTitle.billing.opdBilling",
      preparing: "tv.tokenBoards.laneTitle.preparing",
      readyPickup: "tv.tokenBoards.laneTitle.readyPickup",
      waiting: "tv.tokenBoards.laneTitle.waiting",
      waitingSamples: "tv.tokenBoards.laneTitle.waitingSamples",
      waitingScans: "tv.tokenBoards.laneTitle.waitingScans",
    },
    loading: {
      billing: "tv.tokenBoards.loading.billing",
      emergency: "tv.tokenBoards.loading.emergency",
      lab: "tv.tokenBoards.loading.lab",
      opd: "tv.tokenBoards.loading.opd",
      pharmacy: "tv.tokenBoards.loading.pharmacy",
      radiology: "tv.tokenBoards.loading.radiology",
    },
    scope: {
      department: "tv.tokenBoards.scope.department",
      hospital: "tv.tokenBoards.scope.hospital",
    },
    subtitle: {
      billing: "tv.tokenBoards.subtitle.billing",
      emergency: "tv.tokenBoards.subtitle.emergency",
      lab: "tv.tokenBoards.subtitle.lab",
      opdDepartment: "tv.tokenBoards.subtitle.opdDepartment",
      opdHospital: "tv.tokenBoards.subtitle.opdHospital",
      pharmacy: "tv.tokenBoards.subtitle.pharmacy",
      radiology: "tv.tokenBoards.subtitle.radiology",
    },
    summary: {
      avgScan: "tv.tokenBoards.summary.avgScan",
      avgWait: "tv.tokenBoards.summary.avgWait",
      bays: "tv.tokenBoards.summary.bays",
      collected: "tv.tokenBoards.summary.collected",
      completed: "tv.tokenBoards.summary.completed",
      modality: "tv.tokenBoards.summary.modality",
      now: "tv.tokenBoards.summary.now",
      nowServing: "tv.tokenBoards.summary.nowServing",
      orange: "tv.tokenBoards.summary.orange",
      ready: "tv.tokenBoards.summary.ready",
      red: "tv.tokenBoards.summary.red",
      scope: "tv.tokenBoards.summary.scope",
      total: "tv.tokenBoards.summary.total",
      waiting: "tv.tokenBoards.summary.waiting",
    },
    triageLane: {
      blue: {
        empty: "tv.tokenBoards.triageLane.blue.empty",
        target: "tv.tokenBoards.triageLane.blue.target",
        title: "tv.tokenBoards.triageLane.blue.title",
      },
      green: {
        empty: "tv.tokenBoards.triageLane.green.empty",
        target: "tv.tokenBoards.triageLane.green.target",
        title: "tv.tokenBoards.triageLane.green.title",
      },
      orange: {
        empty: "tv.tokenBoards.triageLane.orange.empty",
        target: "tv.tokenBoards.triageLane.orange.target",
        title: "tv.tokenBoards.triageLane.orange.title",
      },
      red: {
        empty: "tv.tokenBoards.triageLane.red.empty",
        target: "tv.tokenBoards.triageLane.red.target",
        title: "tv.tokenBoards.triageLane.red.title",
      },
      yellow: {
        empty: "tv.tokenBoards.triageLane.yellow.empty",
        target: "tv.tokenBoards.triageLane.yellow.target",
        title: "tv.tokenBoards.triageLane.yellow.title",
      },
    },
    unavailableTitle: {
      billing: "tv.tokenBoards.unavailableTitle.billing",
      emergency: "tv.tokenBoards.unavailableTitle.emergency",
      lab: "tv.tokenBoards.unavailableTitle.lab",
      opd: "tv.tokenBoards.unavailableTitle.opd",
      pharmacy: "tv.tokenBoards.unavailableTitle.pharmacy",
      radiology: "tv.tokenBoards.unavailableTitle.radiology",
    },
    unavailableMessage: {
      billing: "tv.tokenBoards.unavailableMessage.billing",
      emergency: "tv.tokenBoards.unavailableMessage.emergency",
      lab: "tv.tokenBoards.unavailableMessage.lab",
      opd: "tv.tokenBoards.unavailableMessage.opd",
      pharmacy: "tv.tokenBoards.unavailableMessage.pharmacy",
      radiology: "tv.tokenBoards.unavailableMessage.radiology",
    },
  },
} as const;

const TV_MESSAGES: Readonly<Record<string, string>> = {
  "tv.bedStatus.availableLegend": "{{count}} available",
  "tv.bedStatus.displayName": "Bed occupancy",
  "tv.bedStatus.emptyWaiting": "No waiting patients for this ward type",
  "tv.bedStatus.eyebrow": "WARD",
  "tv.bedStatus.feedError":
    "Bed status feed is unreachable. Continuing with the last available occupancy state.",
  "tv.bedStatus.loading": "Loading bed state...",
  "tv.bedStatus.occupancyTitle": "Occupancy",
  "tv.bedStatus.occupiedLegend": "{{count}} occupied",
  "tv.bedStatus.privacyNotice":
    "Waiting list stays masked; names, UHIDs, diagnoses, and bed-transfer notes stay off the ward display.",
  "tv.bedStatus.readiness.privacy.label": "Privacy",
  "tv.bedStatus.readiness.privacy.value": "Masked list",
  "tv.bedStatus.readiness.refresh.label": "Refresh",
  "tv.bedStatus.readiness.refresh.value": "{{seconds}}s",
  "tv.bedStatus.readiness.ward.label": "Ward",
  "tv.bedStatus.subtitle": "Live ward occupancy and masked waiting-list state.",
  "tv.bedStatus.summary.available": "AVAILABLE",
  "tv.bedStatus.summary.occupied": "OCCUPIED",
  "tv.bedStatus.summary.total": "TOTAL",
  "tv.bedStatus.summary.waiting": "WAITING",
  "tv.bedStatus.title": "{{ward}} beds",
  "tv.bedStatus.unavailableMessage": "Check TV pairing, network, and ward display access.",
  "tv.bedStatus.unavailableTitle": "Bed feed unavailable",
  "tv.bedStatus.waitingCase": "Waiting case",
  "tv.bedStatus.waitingLaneTitle": "Waiting list",
  "tv.bedStatus.waitMinutes": "{{minutes}} min",
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
  "tv.tokenBoards.laneEmpty.billing.advanceDeposit": "No advance deposit tokens",
  "tv.tokenBoards.laneEmpty.billing.insuranceDesk": "No insurance desk tokens",
  "tv.tokenBoards.laneEmpty.billing.ipdDischarge": "No IPD discharge bills",
  "tv.tokenBoards.laneEmpty.billing.opdBilling": "No OPD bills waiting",
  "tv.tokenBoards.laneEmpty.calledNow": "No token is currently called",
  "tv.tokenBoards.laneEmpty.collectingNow": "No token is currently called",
  "tv.tokenBoards.laneEmpty.inProgress": "No collections in progress",
  "tv.tokenBoards.laneEmpty.nextTokens": "No waiting tokens",
  "tv.tokenBoards.laneEmpty.nowServing": "No token is currently being dispensed",
  "tv.tokenBoards.laneEmpty.preparing": "No tokens in preparation",
  "tv.tokenBoards.laneEmpty.readyPickup": "No ready tokens",
  "tv.tokenBoards.laneEmpty.waiting": "No prescriptions waiting",
  "tv.tokenBoards.laneEmpty.waitingSamples": "No sample tokens waiting",
  "tv.tokenBoards.laneEmpty.waitingScans": "No radiology tokens waiting",
  "tv.tokenBoards.laneTitle.billing.advanceDeposit": "Advance deposit",
  "tv.tokenBoards.laneTitle.billing.insuranceDesk": "Insurance desk",
  "tv.tokenBoards.laneTitle.billing.ipdDischarge": "IPD discharge",
  "tv.tokenBoards.laneTitle.billing.opdBilling": "OPD billing",
  "tv.tokenBoards.laneTitle.calledNow": "Called now",
  "tv.tokenBoards.laneTitle.collectingNow": "Collecting now",
  "tv.tokenBoards.laneTitle.inProgress": "In progress",
  "tv.tokenBoards.laneTitle.nextTokens": "Next tokens",
  "tv.tokenBoards.laneTitle.nowServing": "Now serving",
  "tv.tokenBoards.laneTitle.preparing": "Preparing",
  "tv.tokenBoards.laneTitle.readyPickup": "Ready pickup",
  "tv.tokenBoards.laneTitle.waiting": "Waiting",
  "tv.tokenBoards.laneTitle.waitingSamples": "Waiting samples",
  "tv.tokenBoards.laneTitle.waitingScans": "Waiting scans",
  "tv.tokenBoards.loading.billing": "Loading billing queue...",
  "tv.tokenBoards.loading.emergency": "Loading emergency triage...",
  "tv.tokenBoards.loading.lab": "Loading lab collection queue...",
  "tv.tokenBoards.loading.opd": "Loading live queue...",
  "tv.tokenBoards.loading.pharmacy": "Loading pharmacy queue...",
  "tv.tokenBoards.loading.radiology": "Loading radiology queue...",
  "tv.tokenBoards.scope.department": "Department",
  "tv.tokenBoards.scope.hospital": "Hospital",
  "tv.tokenBoards.subtitle.billing": "Please proceed to the billing desk when your token shows.",
  "tv.tokenBoards.subtitle.emergency": "Live triage queue with token-only public display.",
  "tv.tokenBoards.subtitle.lab": "Please proceed to sample collection when your token shows.",
  "tv.tokenBoards.subtitle.opdDepartment":
    "Live department token call. Please proceed when your token is called.",
  "tv.tokenBoards.subtitle.opdHospital":
    "Live hospital token call. Please proceed when your token is called.",
  "tv.tokenBoards.subtitle.pharmacy": "Please proceed to the counter when your token shows.",
  "tv.tokenBoards.subtitle.radiology": "Please proceed to the imaging room when your token shows.",
  "tv.tokenBoards.summary.avgScan": "AVG SCAN",
  "tv.tokenBoards.summary.avgWait": "AVG WAIT",
  "tv.tokenBoards.summary.bays": "BAYS",
  "tv.tokenBoards.summary.collected": "COLLECTED",
  "tv.tokenBoards.summary.completed": "COMPLETED",
  "tv.tokenBoards.summary.modality": "Modality",
  "tv.tokenBoards.summary.now": "NOW",
  "tv.tokenBoards.summary.nowServing": "NOW SERVING",
  "tv.tokenBoards.summary.orange": "ORANGE",
  "tv.tokenBoards.summary.ready": "READY",
  "tv.tokenBoards.summary.red": "RED",
  "tv.tokenBoards.summary.scope": "Scope",
  "tv.tokenBoards.summary.total": "TOTAL",
  "tv.tokenBoards.summary.waiting": "WAITING",
  "tv.tokenBoards.triageLane.blue.empty": "No blue triage tokens",
  "tv.tokenBoards.triageLane.blue.target": "Non-urgent",
  "tv.tokenBoards.triageLane.blue.title": "Blue",
  "tv.tokenBoards.triageLane.green.empty": "No green triage tokens",
  "tv.tokenBoards.triageLane.green.target": "Standard",
  "tv.tokenBoards.triageLane.green.title": "Green",
  "tv.tokenBoards.triageLane.orange.empty": "No orange triage tokens",
  "tv.tokenBoards.triageLane.orange.target": "Very urgent",
  "tv.tokenBoards.triageLane.orange.title": "Orange",
  "tv.tokenBoards.triageLane.red.empty": "No red triage tokens",
  "tv.tokenBoards.triageLane.red.target": "Immediate",
  "tv.tokenBoards.triageLane.red.title": "Red",
  "tv.tokenBoards.triageLane.yellow.empty": "No yellow triage tokens",
  "tv.tokenBoards.triageLane.yellow.target": "Urgent",
  "tv.tokenBoards.triageLane.yellow.title": "Yellow",
  "tv.tokenBoards.unavailableTitle.billing": "Billing feed unavailable",
  "tv.tokenBoards.unavailableTitle.emergency": "Triage feed unavailable",
  "tv.tokenBoards.unavailableTitle.lab": "Lab feed unavailable",
  "tv.tokenBoards.unavailableTitle.opd": "Queue feed unavailable",
  "tv.tokenBoards.unavailableTitle.pharmacy": "Pharmacy feed unavailable",
  "tv.tokenBoards.unavailableTitle.radiology": "Radiology feed unavailable",
  "tv.tokenBoards.unavailableMessage.billing":
    "Check TV pairing, network, and billing queue display permissions.",
  "tv.tokenBoards.unavailableMessage.emergency":
    "Check TV pairing, network, and emergency display permissions.",
  "tv.tokenBoards.unavailableMessage.lab": "Check TV pairing, network, and lab display access.",
  "tv.tokenBoards.unavailableMessage.opd":
    "Check TV pairing, network, and queue display permissions.",
  "tv.tokenBoards.unavailableMessage.pharmacy":
    "Check TV pairing, network, and pharmacy queue display permissions.",
  "tv.tokenBoards.unavailableMessage.radiology":
    "Check TV pairing, network, and radiology display access.",
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

export function tvBedStatusAvailableLegend(count: number): string {
  return tvText(TV_TEXT.bedStatus.availableLegend, { count });
}

export function tvBedStatusDisplayName(): string {
  return tvText(TV_TEXT.bedStatus.displayName);
}

export function tvBedStatusEmptyWaitingLabel(): string {
  return tvText(TV_TEXT.bedStatus.emptyWaiting);
}

export function tvBedStatusEyebrow(): string {
  return tvText(TV_TEXT.bedStatus.eyebrow);
}

export function tvBedStatusFeedErrorLabel(): string {
  return tvText(TV_TEXT.bedStatus.feedError);
}

export function tvBedStatusLoadingLabel(): string {
  return tvText(TV_TEXT.bedStatus.loading);
}

export function tvBedStatusLegend({
  deepLink,
  refreshLabel,
  syncLabel,
}: {
  deepLink: string;
  refreshLabel: string;
  syncLabel: string;
}): string {
  return tvText(TV_TEXT.feed.legend, {
    deepLink,
    refresh: refreshLabel,
    sync: syncLabel,
  });
}

export function tvBedStatusOccupancyTitle(): string {
  return tvText(TV_TEXT.bedStatus.occupancyTitle);
}

export function tvBedStatusOccupiedLegend(count: number): string {
  return tvText(TV_TEXT.bedStatus.occupiedLegend, { count });
}

export function tvBedStatusPrivacyNotice(): string {
  return tvText(TV_TEXT.bedStatus.privacyNotice);
}

export function tvBedStatusReadinessLabel(readinessKey: TvBedStatusReadinessKey): string {
  return tvText(TV_TEXT.bedStatus.readiness[readinessKey].label);
}

export function tvBedStatusReadinessValue(
  readinessKey: Exclude<TvBedStatusReadinessKey, "ward">,
  values?: TvTextValues,
): string {
  return tvText(TV_TEXT.bedStatus.readiness[readinessKey].value, values);
}

export function tvBedStatusSubtitle(): string {
  return tvText(TV_TEXT.bedStatus.subtitle);
}

export function tvBedStatusSummaryLabel(summaryKey: TvBedStatusSummaryKey): string {
  return tvText(TV_TEXT.bedStatus.summary[summaryKey]);
}

export function tvBedStatusTitle(ward: string): string {
  return tvText(TV_TEXT.bedStatus.title, { ward });
}

export function tvBedStatusUnavailableMessage(): string {
  return tvText(TV_TEXT.bedStatus.unavailableMessage);
}

export function tvBedStatusUnavailableTitle(): string {
  return tvText(TV_TEXT.bedStatus.unavailableTitle);
}

export function tvBedStatusWaitingCaseLabel(): string {
  return tvText(TV_TEXT.bedStatus.waitingCase);
}

export function tvBedStatusWaitingLaneTitle(): string {
  return tvText(TV_TEXT.bedStatus.waitingLaneTitle);
}

export function tvBedStatusWaitMinutes(minutes: number): string {
  return tvText(TV_TEXT.bedStatus.waitMinutes, { minutes });
}

export function tvTokenBoardFeedErrorLabel(surfaceId: TokenBoardSurfaceId): string {
  return tvText(TV_TEXT.tokenBoards.feedError[surfaceId]);
}

export function tvTokenBoardLaneEmptyLabel(laneKey: TvTokenBoardLaneKey): string {
  return tvText(TV_TEXT.tokenBoards.laneEmpty[laneKey]);
}

export function tvTokenBoardLaneTitle(laneKey: TvTokenBoardLaneKey): string {
  return tvText(TV_TEXT.tokenBoards.laneTitle[laneKey]);
}

export function tvTokenBoardLoadingLabel(surfaceId: TokenBoardSurfaceId): string {
  return tvText(TV_TEXT.tokenBoards.loading[surfaceId]);
}

export function tvTokenBoardScopeLabel(scope: TvTokenBoardScope): string {
  return tvText(TV_TEXT.tokenBoards.scope[scope]);
}

export function tvTokenBoardSubtitle(
  surfaceId: TokenBoardSurfaceId,
  options: { scope?: TvTokenBoardScope } = {},
): string {
  if (surfaceId === "opd") {
    return tvText(
      options.scope === "department"
        ? TV_TEXT.tokenBoards.subtitle.opdDepartment
        : TV_TEXT.tokenBoards.subtitle.opdHospital,
    );
  }

  return tvText(TV_TEXT.tokenBoards.subtitle[surfaceId]);
}

export function tvTokenBoardSummaryLabel(summaryKey: TvTokenBoardSummaryKey): string {
  return tvText(TV_TEXT.tokenBoards.summary[summaryKey]);
}

export function tvTokenBoardTriageLaneText(laneKey: TvTriageLaneKey): {
  emptyLabel: string;
  targetLabel: string;
  title: string;
} {
  const lane = TV_TEXT.tokenBoards.triageLane[laneKey];

  return {
    emptyLabel: tvText(lane.empty),
    targetLabel: tvText(lane.target),
    title: tvText(lane.title),
  };
}

export function tvTokenBoardUnavailableTitle(surfaceId: TokenBoardSurfaceId): string {
  return tvText(TV_TEXT.tokenBoards.unavailableTitle[surfaceId]);
}

export function tvTokenBoardUnavailableMessage(surfaceId: TokenBoardSurfaceId): string {
  return tvText(TV_TEXT.tokenBoards.unavailableMessage[surfaceId]);
}
