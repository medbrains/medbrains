/** What the review step reads to say what a launch would leave empty. */
interface SetupCounts {
  facilities: readonly unknown[];
  departments: readonly unknown[];
  users: readonly unknown[];
  enabledModules: readonly unknown[];
  bedTypes: readonly unknown[];
  taxCategories: readonly unknown[];
}

const EMPTY_WARNINGS: [keyof SetupCounts, string][] = [
  ["facilities", "No additional facilities — only the main hospital will exist."],
  ["departments", "No departments have been added. You can add them later from settings."],
  ["users", "Only the super admin exists — consider adding staff accounts."],
  ["enabledModules", "No modules have been enabled. You can enable them later from settings."],
  ["bedTypes", "No bed types configured — IPD billing will need bed rates added later."],
  ["taxCategories", "No tax categories — billing will default to no tax until configured."],
];

/** One recommendation per part of the setup still empty, in wizard order. */
export function setupWarnings(counts: SetupCounts): string[] {
  return EMPTY_WARNINGS.filter(([key]) => counts[key].length === 0).map(([, text]) => text);
}

/** The review's zone and currency line; an empty choice names the country's default. */
export function localeSummary(d: { timezone?: string | null; currency?: string | null }): string {
  return `${d.timezone ?? "Country's time zone"} · ${d.currency ?? "country's currency"}`;
}
