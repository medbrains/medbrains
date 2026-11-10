// MedBrains Flow (#4901): the live crowd and wait view of the building.
// Every count is an estimate, and `null` means unknown (the source could not
// be read), never zero.

export type FlowSource = "tokens" | "appointments" | "visitors" | "roster";

export interface FlowFloorSummary {
  id: string;
  name: string;
  building_name: string | null;
  zone_count: number;
}

export interface FlowCounterQueue {
  label: string;
  waiting: number;
}

export interface FlowZoneLive {
  location_id: string;
  name: string;
  code: string;
  grid_row: number | null;
  grid_col: number | null;
  capacity: number | null;
  comfort_limit: number | null;
  attendant_factor: number;
  goal_wait_minutes: number | null;
  minute: string | null;
  people_est: number | null;
  patients: number | null;
  waiting: number | null;
  checked_in: number | null;
  visitors: number | null;
  staff: number | null;
  wait_minutes: number | null;
  served_30m: number | null;
  open_counters: number | null;
  counters: FlowCounterQueue[];
  unknown_sources: FlowSource[];
}

export interface FlowAlert {
  id: string;
  location_id: string;
  level: "comfort" | "capacity";
  people_est: number;
  limit_value: number;
  raised_at: string;
  acked_at: string | null;
  resolved_at: string | null;
}

export type FlowDecision = "accepted" | "snoozed" | "dismissed";

export interface FlowRecommendation {
  id: string;
  location_id: string;
  action: "open_counter";
  counters_open: number;
  counters_suggested: number;
  waiting: number;
  wait_before_minutes: number;
  wait_after_minutes: number;
  target_minutes: number;
  decision: FlowDecision | null;
  decided_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface FlowTeamGoal {
  location_id: string;
  goal_wait_minutes: number;
  minutes_met: number;
  minutes_measured: number;
}

export interface FlowFloorLive {
  floor_id: string;
  floor_name: string;
  as_of: string | null;
  stale: boolean;
  zones: FlowZoneLive[];
  alerts: FlowAlert[];
  recommendations: FlowRecommendation[];
  goals: FlowTeamGoal[];
}

export interface FlowSeriesPoint {
  at: string;
  people_est: number | null;
  waiting: number | null;
  wait_minutes: number | null;
}

export interface FlowZoneDetail {
  zone: FlowZoneLive;
  series: FlowSeriesPoint[];
  booked_next_hour: number;
  reasons: string[];
  alerts: FlowAlert[];
  recommendations: FlowRecommendation[];
}

export interface FlowHistoryPoint {
  location_id: string;
  at: string;
  people_est: number | null;
  waiting: number | null;
  wait_minutes: number | null;
}

export interface FlowForecastPoint {
  location_id: string;
  at: string;
  people_est: number | null;
}

export interface FlowForecast {
  start: string;
  step_minutes: number;
  hours: number;
  basis: string;
  points: FlowForecastPoint[];
}

export interface FlowZoneSource {
  id: string;
  zone_location_id: string;
  kind: "department" | "token_queue";
  department_id: string | null;
  department_name: string | null;
  token_module: string | null;
  counter_label: string | null;
}

export interface FlowConfigZone {
  location_id: string;
  name: string;
  code: string;
  configured: boolean;
  capacity: number | null;
  comfort_limit: number | null;
  attendant_factor: number;
  goal_wait_minutes: number | null;
  grid_row: number | null;
  grid_col: number | null;
  sources: FlowZoneSource[];
}

export interface FlowFloorSetup {
  zones: FlowConfigZone[];
  departments: { id: string; name: string }[];
  token_modules: string[];
}

export interface FlowZoneConfigInput {
  capacity: number | null;
  comfort_limit: number | null;
  attendant_factor: number;
  goal_wait_minutes: number | null;
  grid_row: number | null;
  grid_col: number | null;
}

export interface FlowSourceInput {
  kind: "department" | "token_queue";
  department_id?: string | null;
  token_module?: string | null;
  counter_label?: string | null;
}
