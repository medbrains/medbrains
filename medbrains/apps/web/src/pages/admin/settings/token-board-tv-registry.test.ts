// @vitest-environment node

import { TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  TOKEN_BOARD_TV_MODULE_IDS_BY_DISPLAY,
  TOKEN_BOARD_TV_MODULE_REGISTRY,
} from "../../../../../tv/src/modules/token-board-tv-registry";

describe("TV token-board registry", () => {
  it("maps every shared token-board surface to a TV launch entry", () => {
    expect(TOKEN_BOARD_TV_MODULE_REGISTRY.map((entry) => entry.surfaceId)).toEqual(
      TOKEN_BOARD_SURFACE_LIST.map((surface) => surface.id),
    );

    const entryBySurface = new Map(
      TOKEN_BOARD_TV_MODULE_REGISTRY.map((entry) => [entry.surfaceId, entry]),
    );

    for (const surface of TOKEN_BOARD_SURFACE_LIST) {
      const entry = entryBySurface.get(surface.id);
      if (!entry) {
        throw new Error(`Missing TV token-board registry entry for ${surface.id}`);
      }

      expect(entry.appCodes).toEqual(surface.targets.tvAppCodes);
      expect(entry.deepLink).toBe(surface.targets.tvDeepLink);
      expect(entry.displayType).toBe(surface.targets.tvDisplayType);
      expect(entry.moduleId).toBe(
        TOKEN_BOARD_TV_MODULE_IDS_BY_DISPLAY[surface.targets.tvDisplayType],
      );
    }
  });

  it("keeps TV display types unique and covered by module ids", () => {
    const displayTypes = TOKEN_BOARD_TV_MODULE_REGISTRY.map((entry) => entry.displayType);
    const sharedDisplayTypes = [
      ...new Set(TOKEN_BOARD_SURFACE_LIST.map((surface) => surface.targets.tvDisplayType)),
    ].sort();

    expect(new Set(displayTypes).size).toBe(displayTypes.length);
    expect(Object.keys(TOKEN_BOARD_TV_MODULE_IDS_BY_DISPLAY).sort()).toEqual(sharedDisplayTypes);
  });

  it("keeps edge-device routes token-board scoped and app-code backed", () => {
    expect(
      TOKEN_BOARD_TV_MODULE_REGISTRY.every((entry) => entry.deepLink.startsWith("medbrains://tv/")),
    ).toBe(true);
    expect(TOKEN_BOARD_TV_MODULE_REGISTRY.every((entry) => entry.appCodes.length > 0)).toBe(true);
    expect(TOKEN_BOARD_TV_MODULE_REGISTRY.every((entry) => entry.moduleId.length > 0)).toBe(true);
  });
});
