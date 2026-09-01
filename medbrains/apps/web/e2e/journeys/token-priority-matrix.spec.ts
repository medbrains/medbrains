/**
 * Token priority — the order a waiting room is actually called in.
 *
 * Every case issues real tokens through the API and asserts the order the
 * **server** returns. The ordering lives in `public.token_priority_weight` and
 * is read by the board, call-next, the requeue arithmetic and the "how many
 * ahead of me" count; a table in this file agreeing with itself would prove
 * none of it.
 *
 * Each pair is deliberately issued in the *wrong* arrival order — the
 * lower-priority patient first — so that a board which merely preserved
 * arrival order would fail. Sorting by weight is the only way to pass.
 *
 * Every case is a decision somebody has to defend to a waiting room: why that
 * person went first.
 */
import { expect, test } from "@playwright/test";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";

/** The vocabulary, in the order the queue must call it. Lower goes first. */
const PRIORITY_ORDER = [
  { name: "stat", rank: 0, because: "a clinical emergency" },
  { name: "urgent", rank: 1, because: "clinically ahead of the routine list" },
  { name: "emergency_referral", rank: 2, because: "sent by another facility" },
  { name: "elderly", rank: 3, because: "a vulnerability category" },
  { name: "disabled", rank: 3, because: "a vulnerability category" },
  { name: "pregnant", rank: 3, because: "a vulnerability category" },
  { name: "carried_over", rank: 4, because: "waited yesterday, was not seen" },
  { name: "vip", rank: 5, because: "a courtesy, not a clinical claim" },
  { name: "normal", rank: 6, because: "no priority claim" },
] as const;

/**
 * Values no build has heard of.
 *
 * A priority a newer server introduces must sort LAST on an older one —
 * otherwise a future deployment silently jumps every queue in a hospital
 * running last month's binary.
 */
const UNKNOWN_PRIORITIES = ["vip_platinum", "board_member", "URGENT", "priority-1"] as const;

interface BoardToken {
  id: string;
  number: string;
  priority: string;
  seq: number;
  status: string;
}

/**
 * A real department to queue against.
 *
 * A fabricated scope_id is refused — `resolve_scope` checks the scope exists
 * before issuing, so "No location with id …" comes back rather than a token
 * pointed at nothing. That validation is correct, so these cases queue against
 * a department the tenant actually has.
 */
async function realScope(ctx: AuthContext): Promise<string> {
  const departments = await api<Array<{ id: string; code?: string; is_active?: boolean }>>(
    ctx,
    "GET",
    "/api/setup/departments",
  );
  const active = departments.filter((d) => d.is_active !== false);
  const preferred = active.find((d) => d.code === "GEN-MEDICINE") ?? active[0];
  if (!preferred) throw new Error("tenant has no department to queue against");
  return preferred.id;
}

async function issue(
  ctx: AuthContext,
  scopeId: string,
  priority: string,
): Promise<BoardToken> {
  return api<BoardToken>(ctx, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: scopeId,
    priority,
  });
}

/**
 * Where this case's own tokens landed, in board order.
 *
 * The board is shared — other cases and the seeded data are on it too — so
 * each case asserts the *relative* order of the tokens it issued rather than
 * demanding an empty queue. That is also the honest question: given everyone
 * else waiting, was this patient called before that one.
 */
async function orderOfMine(
  ctx: AuthContext,
  scopeId: string,
  ids: string[],
): Promise<string[]> {
  const board = await api<BoardToken[]>(
    ctx,
    "GET",
    `/api/tokens/board?module=opd&scope=department&scope_id=${scopeId}`,
  );
  const mine = new Set(ids);
  return board.filter((t) => mine.has(t.id)).map((t) => t.id);
}

test.describe("token priority — the order the server returns", () => {
  // Every ordered pair: 9 priorities → 36 cases, each one a real pair of
  // tokens on a real board.
  for (let i = 0; i < PRIORITY_ORDER.length; i += 1) {
    for (let j = i + 1; j < PRIORITY_ORDER.length; j += 1) {
      const higher = PRIORITY_ORDER[i];
      const lower = PRIORITY_ORDER[j];
      if (!higher || !lower) continue;

      const tied = higher.rank === lower.rank;
      const title = tied
        ? `${higher.name} and ${lower.name} tie, so arrival order decides`
        : `${higher.name} is called before ${lower.name} even when it arrives second`;

      test(title, async ({ request }) => {
        const ctx = await getAuthContextFromCookies(request);
        const scopeId = await realScope(ctx);

        // The lower priority arrives FIRST. A board that preserved arrival
        // order would now be wrong.
        const first = await issue(ctx, scopeId, lower.name);
        const second = await issue(ctx, scopeId, higher.name);

        const ids = await orderOfMine(ctx, scopeId, [first.id, second.id]);
        expect(ids.length, "both tokens should be on the board").toBe(2);
        if (tied) {
          expect(
            ids,
            `${higher.name} and ${lower.name} share a weight, so the one who arrived first keeps their place`,
          ).toEqual([first.id, second.id]);
        } else {
          expect(
            ids[0],
            `${higher.name} (${higher.because}) must be called before ${lower.name} (${lower.because})`,
          ).toBe(second.id);
        }
      });
    }
  }
});

test.describe("token priority — the vocabulary is enforced at the door", () => {
  // These used to be issued and then checked for sort order. The endpoint now
  // refuses them, which is the better answer: an unrecognised priority that is
  // *stored* still reaches the board, and the console renders
  // `TOKEN_PRIORITY_LABEL[p] ?? p` — so a clinician reads a raw database value
  // off a badge. It sorted harmlessly and displayed as nonsense.
  //
  // The SQL function stays lenient on read, so a row written by a newer server
  // still sorts last rather than first on an older binary. Strict on write,
  // lenient on read.
  for (const unknown of UNKNOWN_PRIORITIES) {
    test(`"${unknown}" is refused rather than stored`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const scopeId = await realScope(ctx);

      await expect(
        issue(ctx, scopeId, unknown),
        `"${unknown}" must not reach the board — nothing downstream can label it`,
      ).rejects.toThrow(/400/);
    });
  }

  test("a priority the vocabulary does carry is accepted", async ({ request }) => {
    // The guard must reject the unknown without rejecting the known.
    const ctx = await getAuthContextFromCookies(request);
    const scopeId = await realScope(ctx);
    const token = await issue(ctx, scopeId, "urgent");
    expect(token.priority).toBe("urgent");
  });

  test("omitting priority still defaults to normal", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const scopeId = await realScope(ctx);
    const token = await api<BoardToken>(ctx, "POST", "/api/tokens/issue", {
      module: "opd",
      scope: "department",
      scope_id: scopeId,
    });
    expect(token.priority).toBe("normal");
  });
});

test.describe("token priority — the boundaries around carried_over", () => {
  // The value this work added. The two boundaries either side of it are the
  // whole argument for where it sits, so they get their own cases rather than
  // being buried in the pairwise sweep.
  for (const clinical of ["stat", "urgent", "emergency_referral", "pregnant"]) {
    test(`carried_over yields to ${clinical}`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const scopeId = await realScope(ctx);

      const owed = await issue(ctx, scopeId, "carried_over");
      const priority = await issue(ctx, scopeId, clinical);

      const ids = await orderOfMine(ctx, scopeId, [owed.id, priority.id]);
      expect(
        ids[0],
        "being owed a slot is not a clinical claim and must not outrank one",
      ).toBe(priority.id);
    });
  }

  test("carried_over outranks vip — a debt owed beats a courtesy extended", async ({
    request,
  }) => {
    const ctx = await getAuthContextFromCookies(request);
    const scopeId = await realScope(ctx);

    const courtesy = await issue(ctx, scopeId, "vip");
    const owed = await issue(ctx, scopeId, "carried_over");

    const ids = await orderOfMine(ctx, scopeId, [courtesy.id, owed.id]);
    expect(ids[0]).toBe(owed.id);
  });

  test("carried_over is called before an ordinary walk-in who arrived first", async ({
    request,
  }) => {
    const ctx = await getAuthContextFromCookies(request);
    const scopeId = await realScope(ctx);

    const walkIn = await issue(ctx, scopeId, "normal");
    const owed = await issue(ctx, scopeId, "carried_over");

    const ids = await orderOfMine(ctx, scopeId, [walkIn.id, owed.id]);
    expect(
      ids[0],
      "somebody sent home unseen yesterday is ahead of today's walk-ins",
    ).toBe(owed.id);
  });
});

test.describe("token priority — what the board hands the client", () => {
  test("every priority returned has a label the UI can render", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const board = await api<BoardToken[]>(
      ctx,
      "GET",
      "/api/tokens/board?module=opd&include_finished=true",
    );
    const known = new Set<string>(PRIORITY_ORDER.map((p) => p.name));
    // No exclusions. Nothing can inject an unlabelled priority any more —
    // the issue endpoint refuses one — so anything here is a real drift
    // between the server's vocabulary and the client's label map.
    const unlabelled = board
      .map((row) => row.priority)
      .filter((priority) => !known.has(priority));

    expect(
      unlabelled,
      "the board returned priorities no label maps — the badge would show a clinician a raw database value",
    ).toEqual([]);
  });

  test("a full spread of priorities comes back in weight order", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const scopeId = await realScope(ctx);

    // Issue the whole vocabulary in reverse, so arrival order is exactly wrong.
    const reversed = [...PRIORITY_ORDER].reverse();
    const issued: Array<{ id: string; priority: string }> = [];
    for (const priority of reversed) {
      const token = await issue(ctx, scopeId, priority.name);
      issued.push({ id: token.id, priority: priority.name });
    }

    const ordered = await orderOfMine(
      ctx,
      scopeId,
      issued.map((i) => i.id),
    );
    expect(ordered.length).toBe(PRIORITY_ORDER.length);

    const rankById = new Map(
      issued.map((i) => [i.id, PRIORITY_ORDER.find((x) => x.name === i.priority)?.rank ?? 6]),
    );
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = rankById.get(ordered[i - 1] ?? "") ?? 6;
      const current = rankById.get(ordered[i] ?? "") ?? 6;
      expect(previous, "board returned a lower priority ahead of a higher one").toBeLessThanOrEqual(
        current,
      );
    }
  });
});
