import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "./query-client.js";

/**
 * The safety net under every mutation in the app.
 *
 * 63 of the 123 mutations on the clinical path define no `onError`. They are
 * not silent, because this net catches them — and that distinction is worth
 * a test, because it is easy to read a call site with no handler and
 * conclude a failure there says nothing to anyone. It says something; the
 * question is only whether the call site can say something better.
 *
 * The second rule is what keeps that true: a page that DOES handle its own
 * errors must not also get the generic toast, or every tailored message is
 * shown next to "Action failed".
 */
async function runFailingMutation(
  client: ReturnType<typeof createQueryClient>,
  options: { onError?: () => void } = {},
) {
  const observer = new MutationObserver(client, {
    mutationFn: async () => {
      throw new Error("not found");
    },
    ...options,
  });
  await observer.mutate().catch(() => {});
}

describe("the app-wide mutation failure net", () => {
  it("reports a mutation that defines no handler of its own", async () => {
    const onMutationError = vi.fn();
    await runFailingMutation(createQueryClient({ onMutationError }));

    expect(onMutationError).toHaveBeenCalledTimes(1);
    expect(onMutationError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("stays out of the way of a call site that handles its own", async () => {
    const onMutationError = vi.fn();
    const ownHandler = vi.fn();
    await runFailingMutation(createQueryClient({ onMutationError }), { onError: ownHandler });

    expect(ownHandler).toHaveBeenCalledTimes(1);
    expect(
      onMutationError,
      "a tailored message must not be shown beside the generic one",
    ).not.toHaveBeenCalled();
  });

  it("leaves an expired session to the auth path rather than toasting it", async () => {
    const onMutationError = vi.fn();
    const client = createQueryClient({ onMutationError });
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        throw new Error("session_expired");
      },
    });
    await observer.mutate().catch(() => {});

    expect(
      onMutationError,
      "an expired session logs the user out; a toast about it is noise",
    ).not.toHaveBeenCalled();
  });
});
