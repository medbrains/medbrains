// @vitest-environment node

import type { ModuleToken } from "@medbrains/types";
import { recentlyMissedTokens } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";

/**
 * The came-back panel's fetch has to ask for finished tokens.
 *
 * `GET /api/tokens/board` returns only waiting, called and serving unless
 * `include_finished` is set — the SQL predicate is
 * `status IN ('waiting','called','serving') OR ($4 AND status IN ('completed','no_show'))`,
 * and an absent flag binds NULL, which is never true.
 *
 * The panel filtered that result for `no_show`, so it matched nothing and
 * rendered null on every mount. `recentlyMissedTokens` was unit-tested and
 * correct throughout; the defect was entirely in what it was handed. This
 * test covers that join, which is where it hid.
 */

vi.mock("@medbrains/api", () => ({
  api: { listTokenBoard: vi.fn(async () => [] as ModuleToken[]) },
}));

const { api } = await import("@medbrains/api");
const { frontOfficeService } = await import("@/services/frontOffice.service");

describe("the board read behind the came-back panel", () => {
  it("asks for finished tokens, without which a no-show can never come back", async () => {
    await frontOfficeService.listOpdTokenBoard();

    expect(api.listTokenBoard).toHaveBeenCalledWith(
      expect.objectContaining({ module: "opd", include_finished: true }),
    );
  });

  it("keeps a no-show once it is fetched — the filter is not what was broken", () => {
    const missed = [
      { status: "no_show", completed_at: new Date().toISOString() } as unknown as ModuleToken,
    ];
    expect(recentlyMissedTokens(missed, Date.now())).toHaveLength(1);
  });
});
