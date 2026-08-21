/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import { createDeviceSyncModule, type Module } from "@medbrains/mobile-shell";
import { billingModule } from "./billing";
import { bloodBankModule } from "./blood-bank";
import { bmeModule } from "./bme";
import { doctorModule } from "./doctor";
import { facilitiesModule } from "./facilities";
import { housekeepingModule } from "./housekeeping";
import { hrModule } from "./hr";
import { labModule } from "./lab";
import { nurseModule } from "./nurse";
import { pharmacyModule } from "./pharmacy";
import { receptionModule } from "./reception";
import { securityModule } from "./security";

/**
 * Order is not cosmetic: the shell mounts one screen per permitted module and
 * opens on the first, so this list decides where each role lands. A
 * receptionist holds `billing.invoices.list` for taking payments, and with
 * reception at the bottom that landed them in Billing every morning.
 *
 * Desk and clinical modules first, cross-cutting ones after.
 */
export const MODULES: ReadonlyArray<Module> = [
  doctorModule,
  nurseModule,
  receptionModule,
  pharmacyModule,
  labModule,
  bloodBankModule,
  billingModule,
  bmeModule,
  facilitiesModule,
  housekeepingModule,
  securityModule,
  hrModule,
  createDeviceSyncModule(["Mobile-Admin"]),
];
