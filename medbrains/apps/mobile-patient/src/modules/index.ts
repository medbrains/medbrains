/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import type { CompanionAccess } from "../health/companion-access.js";
import { isOpen } from "../health/companion-access.js";
import { appointmentsModule } from "./appointments";
import { bandsModule } from "./bands";
import { billsModule } from "./bills";
import { consentModule } from "./consent";
import { familyShareModule } from "./family-share";
import { labReportsModule } from "./lab-reports";
import { prescriptionsModule } from "./prescriptions";
import { todayModule } from "./today";

/** The hospital record. Always present — it is why a patient was given the app. */
export const HOSPITAL_MODULES: ReadonlyArray<Module> = [
  appointmentsModule,
  labReportsModule,
  prescriptionsModule,
  billsModule,
  consentModule,
  familyShareModule,
];

/** The companion. Present only when an entitlement opened it. */
const HEALTH_MODULES: ReadonlyArray<Module> = [todayModule, bandsModule];

/**
 * The list the shell renders.
 *
 * The companion is appended rather than declared, so "hidden" is the absence
 * of a module rather than a module that renders a locked screen. A locked
 * screen is an advert; an absent tab is navigation.
 */
export function modulesFor(access: CompanionAccess): ReadonlyArray<Module> {
  return isOpen(access) ? [...HOSPITAL_MODULES, ...HEALTH_MODULES] : HOSPITAL_MODULES;
}

/** Kept for callers that only need the hospital set. */
export const MODULES = HOSPITAL_MODULES;
