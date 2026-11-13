import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * Approving a waiting screen. The list never carries the code the screen
 * shows, so Approve stays off until the administrator has typed one from the
 * screen, and the typed code is what is sent.
 */
const approve = vi.fn(async (_body: Record<string, unknown>) => ({}));

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listDevicePairingRequests: async () => [
        {
          id: "req-1",
          reference: "AB12CD",
          app_variant: "tv",
          requested_label: "Waiting-room screen",
          expires_at: "2026-11-13T10:15:00Z",
          created_at: "2026-11-13T10:00:00Z",
        },
      ],
      listDepartments: async () => [{ id: "dept-1", name: "General OPD" }],
      listStations: async () => [],
      getTenant: async () => ({ id: "t", code: "CITYHOSP" }),
      approveDevicePairingRequest: approve,
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: () => true,
}));

const { PendingScreensCard, isCompleteCode } = await import("./PendingScreensCard");

describe("approving a waiting screen", () => {
  it("counts a code as complete only with all eight letters and digits", () => {
    expect(isCompleteCode("ab12-cd34")).toBe(true);
    expect(isCompleteCode("AB12 CD3")).toBe(false);
    expect(isCompleteCode("")).toBe(false);
  });

  it("shows what is asking, keeps Approve off until the code is typed, and sends it", async () => {
    const user = userEvent.setup();
    render(<PendingScreensCard />);

    expect(await screen.findByText("Screen AB12CD")).toBeInTheDocument();
    expect(screen.getByText("Screen (TV)")).toBeInTheDocument();
    expect(await screen.findByText(/screen\?hospital=CITYHOSP/)).toBeInTheDocument();
    const button = screen.getByTestId("btn-approve-screen-AB12CD");

    await user.click(screen.getByTestId("picker-screen-department-AB12CD"));
    await user.click(await screen.findByRole("option", { name: "General OPD", hidden: true }));
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/Code on the screen/), "wxyz-2345");
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(approve).toHaveBeenCalled());
    expect(approve.mock.calls[0]?.[0]).toMatchObject({
      request_id: "req-1",
      user_code: "wxyz-2345",
      deny: false,
      department_id: "dept-1",
      board_module: "opd",
    });
  });
});
