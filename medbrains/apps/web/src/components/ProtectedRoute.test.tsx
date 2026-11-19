import { endClientSession, useAuthStore, usePermissionStore } from "@medbrains/stores";
import type { User } from "@medbrains/types";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionService } from "@/services/session.service";
import { render, screen } from "@/test/test-utils";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/services/session.service", () => ({
  sessionService: {
    me: vi.fn(async () => ({
      role: "doctor",
      permissions: [],
      must_change_password: false,
      mfa_enrollment_required: false,
    })),
    getTenantSettings: vi.fn(async () => []),
    refreshToken: vi.fn(),
  },
}));

const poll = vi.fn(async () => 1);

/** A signed-in screen that polls, like the unread-count badge. */
function PollingScreen() {
  useQuery({ queryKey: ["unread-count"], queryFn: poll, refetchInterval: 1_000 });
  return <p>signed in</p>;
}

afterEach(() => {
  vi.useRealTimers();
  poll.mockClear();
});

describe("signing out", () => {
  it("stops the signed-in screens polling at once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useAuthStore.getState().setAuth({ id: "u1", username: "doc" } as User);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ProtectedRoute>
        <PollingScreen />
      </ProtectedRoute>,
      { queryClient },
    );
    await screen.findByText("signed in");
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(poll.mock.calls.length).toBeGreaterThan(1);

    act(() => endClientSession(queryClient));
    const before = poll.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(screen.queryByText("signed in")).not.toBeInTheDocument();
    expect(poll.mock.calls.length).toBe(before);
  });
});

describe("an access check that fails", () => {
  it("says access could not be checked, never shows an app list built from nothing", async () => {
    useAuthStore.getState().setAuth({ id: "u1", username: "desk" } as User);
    usePermissionStore.getState().clearPermissions();
    vi.mocked(sessionService.me).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(
      <ProtectedRoute>
        <p>your apps</p>
      </ProtectedRoute>,
    );
    expect(await screen.findByText("We couldn't check your access")).toBeInTheDocument();
    expect(screen.queryByText("your apps")).not.toBeInTheDocument();
  });
});
