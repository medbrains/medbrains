/**
 * Camp app module registry.
 *
 * This app is purpose-built for outreach camps, so the shell renders
 * only Camp Mode instead of the full staff module list.
 */

import { createDeviceSyncModule, type Module } from "@medbrains/mobile-shell";
import { campModule } from "./camp";

// Camp Mode plus the one setup step a camp device cannot do without:
// a phone going out to a field camp is exactly the device that has to
// sync with no server reachable, and it cannot until its key is bound.
export const MODULES: ReadonlyArray<Module> = [campModule, createDeviceSyncModule(["Mobile-Camp"])];
