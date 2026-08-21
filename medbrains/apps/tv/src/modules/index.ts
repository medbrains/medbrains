/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import type { TokenBoardTvDisplayType } from "@medbrains/types";
import { bedStatusModule } from "./bed-status";
import { billingQueueModule } from "./billing-queue";
import { campQueueModule } from "./camp-queue";
import { digitalSignageModule } from "./digital-signage";
import { emergencyTriageModule } from "./emergency-triage";
import { labStatusModule } from "./lab-status";
import { nurseCallsModule } from "./nurse-calls";
import { pharmacyQueueModule } from "./pharmacy-queue";
import { queueModule } from "./queue";
import { radiologyQueueModule } from "./radiology-queue";
import {
  TOKEN_BOARD_TV_MODULE_REGISTRY,
  type TokenBoardTvModuleRegistryEntry,
} from "./token-board-tv-registry";

export const TOKEN_BOARD_TV_MODULES = {
  billing_queue: billingQueueModule,
  camp_queue: campQueueModule,
  emergency_triage: emergencyTriageModule,
  lab_queue: labStatusModule,
  opd_queue: queueModule,
  pharmacy_queue: pharmacyQueueModule,
  radiology_queue: radiologyQueueModule,
} satisfies Record<TokenBoardTvDisplayType, Module>;

function tokenBoardTvModuleForEntry(entry: TokenBoardTvModuleRegistryEntry): Module {
  const module = TOKEN_BOARD_TV_MODULES[entry.displayType];
  if (module.id !== entry.moduleId) {
    throw new Error(
      `Token-board TV module mismatch for ${entry.surfaceId}: expected ${entry.moduleId}, got ${module.id}`,
    );
  }
  return module;
}

export const TOKEN_BOARD_TV_MODULE_LIST = TOKEN_BOARD_TV_MODULE_REGISTRY.map(
  tokenBoardTvModuleForEntry,
);

export const MODULES: ReadonlyArray<Module> = [
  ...TOKEN_BOARD_TV_MODULE_LIST,
  bedStatusModule,
  digitalSignageModule,
  nurseCallsModule,
];
