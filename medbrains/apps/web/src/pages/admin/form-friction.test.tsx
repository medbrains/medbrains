import type { FormFrictionReport } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { FormFrictionPage } from "./form-friction";

const api = vi.hoisted(() => ({ getFormFriction: vi.fn() }));
vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/api")>()),
  api,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const VIEW = "admin.form_friction.view";

const report: FormFrictionReport = {
  days: 30,
  since: "2026-10-16",
  total: 7,
  previous_total: 2,
  routes: [
    {
      method: "POST",
      route: "/api/specialty/ophthalmology/exams",
      count: 7,
      previous: 2,
      messages: [
        { message: "Right eye axis given without a cylinder", count: 7, roles: ["doctor"] },
      ],
    },
  ],
};

describe("Admin → Form friction", () => {
  beforeEach(() => {
    held.clear();
    api.getFormFriction.mockReset();
  });

  it("does not ask the server without the permission", () => {
    render(<FormFrictionPage />);
    expect(api.getFormFriction).not.toHaveBeenCalled();
  });

  it("ranks refused screens with their reasons and trend", async () => {
    held.add(VIEW);
    api.getFormFriction.mockResolvedValue(report);
    render(<FormFrictionPage />);
    expect(await screen.findByText("Specialty › Ophthalmology › Exams")).toBeInTheDocument();
    expect(screen.getByText("Right eye axis given without a cylinder")).toBeInTheDocument();
    expect(screen.getByText("+250%")).toBeInTheDocument();
    expect(screen.getByTestId("friction-totals")).toHaveTextContent("7 refused in the last 30");
    expect(api.getFormFriction).toHaveBeenCalledWith(30);
  });

  it("asks for the period picked", async () => {
    held.add(VIEW);
    api.getFormFriction.mockResolvedValue(report);
    render(<FormFrictionPage />);
    await screen.findByTestId("friction-totals");
    await userEvent.click(screen.getByText("7 days"));
    await waitFor(() => expect(api.getFormFriction).toHaveBeenCalledWith(7));
  });

  it("says so when nothing was refused", async () => {
    held.add(VIEW);
    api.getFormFriction.mockResolvedValue({ ...report, total: 0, previous_total: 0, routes: [] });
    render(<FormFrictionPage />);
    expect(await screen.findByTestId("friction-empty")).toHaveTextContent(
      "No save was refused in the last 30 days",
    );
  });

  it("shows an outage as unknown, never as no refusals", async () => {
    held.add(VIEW);
    api.getFormFriction.mockRejectedValue(new Error("down"));
    render(<FormFrictionPage />);
    expect(await screen.findByTestId("friction-error")).toBeInTheDocument();
    expect(screen.queryByTestId("friction-empty")).not.toBeInTheDocument();
  });
});
