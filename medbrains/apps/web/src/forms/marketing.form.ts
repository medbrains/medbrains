import { z } from "zod";

/**
 * The server takes `channel` and `source` as free text, so the vocabulary
 * lives here. Keeping it in one place means the campaign form and the contact
 * filter cannot drift into two spellings of "whatsapp".
 */
export const CAMPAIGN_CHANNEL_VALUES = [
  "google_ads",
  "meta",
  "whatsapp",
  "sms",
  "print",
  "radio",
  "referral",
  "event",
  "walk_in",
  "other",
] as const;

const channelLabels: Record<(typeof CAMPAIGN_CHANNEL_VALUES)[number], string> = {
  google_ads: "Google Ads",
  meta: "Meta (Facebook / Instagram)",
  whatsapp: "WhatsApp",
  sms: "SMS",
  print: "Print",
  radio: "Radio",
  referral: "Referral",
  event: "Camp / Event",
  walk_in: "Walk-in",
  other: "Other",
};

export const CAMPAIGN_CHANNEL_OPTIONS = CAMPAIGN_CHANNEL_VALUES.map((value) => ({
  value,
  label: channelLabels[value],
}));

/**
 * Spend is entered in rupees and stored in paise.
 *
 * The column is `spend_minor` and the Rust doc comment says why: money in a
 * float is how a reconciliation report stops reconciling. Entering rupees and
 * sending them unconverted is wrong by a factor of a hundred, silently, in the
 * direction that flatters the cost-per-enquiry.
 */
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => paise / 100;

export const marketingCampaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(160),
  channel: z.enum(CAMPAIGN_CHANNEL_VALUES),
  source: z.string().trim().min(1, "Source is required").max(120),
  external_ref: z.string().trim().max(160),
  /** Rupees in the form; converted on submit. */
  spend_rupees: z.number().min(0, "Spend cannot be negative"),
  started_on: z.string(),
  ended_on: z.string(),
  /**
   * Free text rather than a fixed list. A campaign is planned before the
   * localities are defined in the master, and blocking the plan on data entry
   * elsewhere is how the field ends up empty forever.
   */
  target_areas: z.array(z.string().trim().min(1)),
  medium: z.string().trim().max(80),
});

export type MarketingCampaignFormInput = z.infer<typeof marketingCampaignSchema>;

/**
 * The physical channels a run can be. Narrower than the touchpoint list: a
 * hospital distributes pamphlets, it does not distribute a phone call.
 */
export const DISTRIBUTION_CHANNEL_OPTIONS = [
  { value: "pamphlet", label: "Pamphlets" },
  { value: "hoarding", label: "Hoarding" },
  { value: "newspaper", label: "Newspaper" },
  { value: "magazine", label: "Magazine" },
  { value: "radio", label: "Radio" },
  { value: "cable_tv", label: "Cable TV" },
  { value: "bus_panel", label: "Bus panel" },
  { value: "signage", label: "Signage" },
  { value: "camp_walkin", label: "Health camp" },
  { value: "health_talk", label: "Health talk" },
  { value: "corporate_screening", label: "Corporate screening" },
] as const;

const DISTRIBUTION_CHANNEL_VALUES = DISTRIBUTION_CHANNEL_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

export const distributionSchema = z.object({
  area_id: z.string().min(1, "Choose the locality this went to"),
  campaign_id: z.string(),
  channel: z.enum(DISTRIBUTION_CHANNEL_VALUES),
  quantity: z.number().int().min(1, "One hoarding is 1"),
  distributed_on: z.string().min(1, "When did it go out?"),
  /** Rupees in the form; converted to paise on submit, like campaign spend. */
  cost_rupees: z.number().min(0, "Cost cannot be negative"),
  /**
   * How long a pamphlet keeps working. Bounded to match the CHECK constraint
   * in 0998 so a rejected value is caught here rather than by the database.
   */
  response_window_days: z.number().int().min(1).max(730),
  /**
   * Optional, and worth leaving blank rather than guessing: the report charts
   * only runs that carry one, because a bar drawn against an invented
   * expectation is worse than no bar.
   */
  expected_enquiries: z.number().int().min(0).nullable(),
  note: z.string().trim().max(500),
});

export type DistributionFormInput = z.infer<typeof distributionSchema>;

export const areaSchema = z.object({
  name: z.string().trim().min(1, "A locality needs a name").max(120),
  /**
   * Coordinates are optional — a locality without them still reports, it just
   * does not appear on the map. Bounds match the CHECK constraints in 0998.
   */
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  pincode: z.string().trim().max(12),
  population: z.number().int().min(0).nullable(),
});

export type AreaFormInput = z.infer<typeof areaSchema>;
