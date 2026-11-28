import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/test-utils";

/**
 * My Day that failed to load shows "—" on its tiles, never 0 (#6009): a zero
 * tells a doctor they have nothing to sign and no patients today.
 */
const getMyDay = vi.fn();
vi.mock("@/services/doctor.service", () => ({
  doctorService: {
    getMyDay: () => getMyDay(),
    getMyProfile: () => Promise.reject(new Error("no profile")),
  },
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const { MyDayPage } = await import("./my-day");

/** The number on the tile labelled `label`. */
function tileValue(label: string): string {
  const tile = screen.getByText(label).closest(".mantine-Card-root") as HTMLElement;
  return within(tile).getAllByText(/^(\d+|—)$/)[0]?.textContent ?? "";
}

describe("MyDayPage", () => {
  it("shows a failed load as unknown, not as zero", async () => {
    getMyDay.mockRejectedValue(new Error("500"));
    render(<MyDayPage />);
    expect(await screen.findByRole("button", { name: "Sign-off queue (—)" })).toBeVisible();
    expect(tileValue("Pending sign-offs")).toBe("—");
    expect(tileValue("Appointments today")).toBe("—");
  });

  it("shows the real counts when the day loads", async () => {
    getMyDay.mockResolvedValue({
      doctor_user_id: "d",
      today: {
        appointments_total: 0,
        appointments_remaining: 0,
        ot_cases: 0,
        ipd_patients_under_care: 0,
        critical_alerts: 0,
      },
      pending_signoffs: { clinical: 2, medico_legal: 0, overdue: 0, total: 2 },
      on_call: { is_on_call_now: false, next_on_call_at: null },
      coverage: [],
    });
    render(<MyDayPage />);
    expect(await screen.findByRole("button", { name: "Sign-off queue (2)" })).toBeVisible();
    expect(tileValue("Appointments today")).toBe("0");
  });
});
