/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { appointmentsModule } from "./appointments";
import { labReportsModule } from "./lab-reports";
import { prescriptionsModule } from "./prescriptions";
import { billsModule } from "./bills";
import { consentModule } from "./consent";
import { familyShareModule } from "./family-share";


export const MODULES: ReadonlyArray<Module> = [
  appointmentsModule,
  labReportsModule,
  prescriptionsModule,
  billsModule,
  consentModule,
  familyShareModule,

];
