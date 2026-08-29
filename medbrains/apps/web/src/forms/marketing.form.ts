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
});

export type MarketingCampaignFormInput = z.infer<typeof marketingCampaignSchema>;
