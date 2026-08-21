/**
 * Which tab a module belongs to.
 *
 * The app answers two different questions and they should not be mixed in one
 * list. **Hospital** is the record a clinician wrote — appointments, bills,
 * consent, lab reports, prescriptions, family sharing. **Health** is what the
 * person does day to day, and it is where a band connects.
 *
 * The split is declared here rather than on `Module` because it is this app's
 * information architecture, not a property of the shared shell contract. A
 * staff app grouping its modules this way would be meaningless.
 */

export type TabKey = "hospital" | "health";

/** Module id → tab. A module missing from this map lands in Hospital. */
const TAB_BY_MODULE: Readonly<Record<string, TabKey>> = {
  appointments: "hospital",
  "lab-reports": "hospital",
  prescriptions: "hospital",
  bills: "hospital",
  consent: "hospital",
  "family-share": "hospital",
  today: "health",
  bands: "health",
};

export function tabFor(moduleId: string): TabKey {
  return TAB_BY_MODULE[moduleId] ?? "hospital";
}

export const TAB_LABEL: Readonly<Record<TabKey, string>> = {
  hospital: "Hospital",
  health: "Health",
};
