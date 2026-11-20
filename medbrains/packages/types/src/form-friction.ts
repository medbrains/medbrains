/** One refusal reason on a route, and the roles that met it this period. */
export interface FrictionMessage {
  /** Scrubbed of every typed value: digits are `#`, quoted text `[value]`. */
  message: string;
  count: number;
  roles: string[];
}

/** One route's refusals this period and the period before. */
export interface FrictionRoute {
  method: string;
  /** The route template, e.g. `/api/specialty/ophthalmology/exams`. */
  route: string;
  count: number;
  previous: number;
  messages: FrictionMessage[];
}

/** `GET /api/admin/form-friction` — refused saves (400/422) ranked by route. */
export interface FormFrictionReport {
  days: number;
  /** First day of the period (UTC). */
  since: string;
  total: number;
  previous_total: number;
  routes: FrictionRoute[];
}
