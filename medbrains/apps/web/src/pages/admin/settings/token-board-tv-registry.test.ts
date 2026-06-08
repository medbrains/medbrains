// @vitest-environment node

import {
  BILLING_QUEUE_LANES,
  TOKEN_BOARD_SURFACE_LIST,
  tokenBoardRefreshLabel,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  TV_TEXT,
  tvText,
  tvTokenBoardFeedErrorLabel,
  tvTokenBoardLaneEmptyLabel,
  tvTokenBoardLaneTitle,
  tvTokenBoardLoadingLabel,
  tvTokenBoardSummaryLabel,
  tvTokenBoardTriageLaneText,
  tvTokenBoardUnavailableMessage,
  tvTokenBoardUnavailableTitle,
} from "../../../../../tv/src/components/tv-i18n";
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

  it("backs token-board TV feed text with shared i18n keys", () => {
    expect(tvText(TV_TEXT.feed.notSynced)).toBe("not synced");

    for (const surface of TOKEN_BOARD_SURFACE_LIST) {
      expect(tvTokenBoardFeedErrorLabel(surface.id)).toContain("feed is unreachable");
      expect(tvTokenBoardLoadingLabel(surface.id)).toContain("Loading");
      expect(tvTokenBoardUnavailableTitle(surface.id)).toContain("unavailable");
      expect(tvTokenBoardUnavailableMessage(surface.id)).toContain("TV pairing");
      expect(tvTokenBoardFeedErrorLabel(surface.id)).not.toBe(
        TV_TEXT.tokenBoards.feedError[surface.id],
      );
      expect(
        tvText(TV_TEXT.feed.legend, {
          deepLink: surface.targets.tvDeepLink,
          refresh: tokenBoardRefreshLabel(surface),
          sync: tvText(TV_TEXT.feed.notSynced),
        }),
      ).toContain(surface.targets.tvDeepLink);
    }

    for (const lane of BILLING_QUEUE_LANES) {
      expect(tvTokenBoardLaneTitle(lane.key)).toBe(lane.title);
      expect(tvTokenBoardLaneEmptyLabel(lane.key)).toBe(lane.emptyLabel);
    }

    expect(tvTokenBoardSummaryLabel("nowServing")).toBe("NOW SERVING");
    expect(tvTokenBoardSummaryLabel("avgWait")).toBe("AVG WAIT");
    expect(tvTokenBoardLaneTitle("calledNow")).toBe("Called now");
    expect(tvTokenBoardLaneEmptyLabel("waitingScans")).toBe("No radiology tokens waiting");
    expect(tvTokenBoardTriageLaneText("red")).toEqual({
      emptyLabel: "No red triage tokens",
      targetLabel: "Immediate",
      title: "Red",
    });
  });
});
