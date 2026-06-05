/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { TOKEN_BOARD_SURFACE_LIST, type TokenBoardTvDisplayType } from "@medbrains/types";
import { bedStatusModule } from "./bed-status";
import { billingQueueModule } from "./billing-queue";
import { digitalSignageModule } from "./digital-signage";
import { emergencyTriageModule } from "./emergency-triage";
import { labStatusModule } from "./lab-status";
import { pharmacyQueueModule } from "./pharmacy-queue";
import { queueModule } from "./queue";
import { radiologyQueueModule } from "./radiology-queue";

export const TOKEN_BOARD_TV_MODULES = {
  billing_queue: billingQueueModule,
  emergency_triage: emergencyTriageModule,
  lab_queue: labStatusModule,
  opd_queue: queueModule,
  pharmacy_queue: pharmacyQueueModule,
  radiology_queue: radiologyQueueModule,
} satisfies Record<TokenBoardTvDisplayType, Module>;

export const TOKEN_BOARD_TV_MODULE_LIST = TOKEN_BOARD_SURFACE_LIST.map(
  (surface) => TOKEN_BOARD_TV_MODULES[surface.targets.tvDisplayType],
);

export const MODULES: ReadonlyArray<Module> = [
  ...TOKEN_BOARD_TV_MODULE_LIST,
  bedStatusModule,
  digitalSignageModule,
];
