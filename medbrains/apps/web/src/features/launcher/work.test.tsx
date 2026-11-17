import { usePermissionStore } from "@medbrains/stores";
import type { WorkItem } from "@medbrains/types";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { initReactI18next } from "react-i18next";
import { Route, Routes } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import LauncherPage from "@/pages/launcher";
import { server } from "@/test/server";
import { render, screen } from "@/test/test-utils";
import nav from "../../../public/locales/en/nav.json";
import { countLabel, waitingState } from "./workModel";

/** Five minutes ago, as the server would send it. */
const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60_000).toISOString();

/** A work item as the server sends it, `ok` with `count` unless overridden. */
function item(key: WorkItem["key"], count: number | null, over: Partial<WorkItem> = {}): WorkItem {
  const now = key === "lab_critical";
  return {
    key,
    brick: { lab_critical: "lab", opd_waiting: "opd", notes_unsigned: "opd", approvals: null }[key],
    section: now ? "now" : "waiting",
    severity: now ? "critical" : "info",
    status: count === null ? "failed" : "ok",
    count,
    capped: false,
    detail: null,
    href: {
      lab_critical: "/doctor/signoffs",
      opd_waiting: "/opd",
      notes_unsigned: "/doctor/signoffs",
      approvals: "/approvals",
    }[key],
    ...over,
  };
}

const CRITICAL = item("lab_critical", 1, {
  detail: {
    kind: "critical_result",
    parameter: "Potassium",
    value: "6.8",
    unit: "mmol/L",
    reported_at: FIVE_MIN_AGO,
    patient: { name: "A. Rao", uhid: "10-4471" },
  },
});
const OPD = item("opd_waiting", 12, {
  detail: { kind: "queue_wait", longest_minutes: 38, long_waits: 3, long_wait_minutes: 30 },
});

/** Opens the launcher for a doctor holding `codes`, with the work read answering `items`. */
function openWith(
  items: WorkItem[] | "error",
  codes = ["lab.orders.list", "pharmacy.prescriptions.list"],
) {
  server.use(
    http.get("*/api/users/me/launcher", () => HttpResponse.json({ favourites: [], bricks: [] })),
    http.get("*/api/users/me/work", () =>
      items === "error" ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ items }),
    ),
  );
  usePermissionStore.getState().setPermissions("doctor", codes);
  render(
    <Routes>
      <Route path="/home" element={<LauncherPage />} />
      <Route path="/lab" element={<p>Lab worklist</p>} />
    </Routes>,
    { initialEntries: ["/home"] },
  );
}

beforeAll(() =>
  // React escapes on render, so the app turns i18next's escaping off (src/i18n.ts); so do we.
  i18n.use(initReactI18next).init({
    lng: "en",
    ns: ["nav"],
    resources: { en: { nav } },
    interpolation: { escapeValue: false },
  }),
);
afterEach(() => usePermissionStore.getState().clearPermissions());

describe("launcher work", () => {
  it("puts a critical value first, in words, with the patient the server named", async () => {
    openWith([CRITICAL, OPD]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Critical result");
    expect(alert).toHaveTextContent("Potassium 6.8 mmol/L for A. Rao (UHID 10-4471)");
    expect(alert).toHaveTextContent("reported 5 min ago, not yet acknowledged");
  });

  it("keeps a critical item that failed in Needs you now, telling the person to check", async () => {
    openWith([item("lab_critical", null)]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Critical results didn't load");
    expect(alert).toHaveTextContent("not an all-clear");
  });

  it("shows a failed count as didn't load, never 0, and never says nothing is waiting", async () => {
    openWith([OPD, item("notes_unsigned", null), item("approvals", 0)]);
    await screen.findByText("Didn't load");
    const waiting = screen.getByRole("region", { name: "Waiting for you" });
    expect(waiting).toHaveTextContent("Didn't load");
    expect(waiting).not.toHaveTextContent(/Notes to sign\s*0/);
    expect(waiting).toHaveTextContent("3 waiting over 30 min");
    expect(screen.queryByText("Nothing waiting for you.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says nothing is waiting only when every item loaded at 0", async () => {
    openWith([item("opd_waiting", 0), item("approvals", 0)]);
    expect(await screen.findByText("Nothing waiting for you.")).toBeInTheDocument();
  });

  it("says the whole read failed rather than showing an empty section", async () => {
    openWith("error");
    expect(await screen.findByText("Your work didn't load")).toBeInTheDocument();
    expect(screen.queryByText("Nothing waiting for you.")).not.toBeInTheDocument();
  });

  it("keeps a one-app person on the launcher while a critical value waits", async () => {
    openWith([CRITICAL], ["lab.orders.list"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Critical result");
    expect(screen.queryByText("Lab worklist")).not.toBeInTheDocument();
  });

  it("hides the section for someone with no work items, and shows 99+ when capped", () => {
    expect(waitingState([CRITICAL])).toEqual({ kind: "hidden" });
    expect(countLabel(item("opd_waiting", 99, { capped: true }))).toBe("99+");
  });

  it("shows an app's live count on its tile", async () => {
    openWith([CRITICAL], ["lab.orders.list", "pharmacy.prescriptions.list"]);
    const apps = await screen.findByRole("region", { name: "Your apps" });
    expect(apps).toHaveTextContent("1 critical");
  });
});
