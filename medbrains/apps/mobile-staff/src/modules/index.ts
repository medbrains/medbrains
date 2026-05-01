/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { doctorModule } from "./doctor";
import { nurseModule } from "./nurse";
import { pharmacyModule } from "./pharmacy";
import { labModule } from "./lab";
import { billingModule } from "./billing";
import { bmeModule } from "./bme";
import { facilitiesModule } from "./facilities";
import { housekeepingModule } from "./housekeeping";
import { securityModule } from "./security";
import { hrModule } from "./hr";
import { receptionModule } from "./reception";


export const MODULES: ReadonlyArray<Module> = [
  doctorModule,
  nurseModule,
  pharmacyModule,
  labModule,
  billingModule,
  bmeModule,
  facilitiesModule,
  housekeepingModule,
  securityModule,
  hrModule,
  receptionModule,

];
