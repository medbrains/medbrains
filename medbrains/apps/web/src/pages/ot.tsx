import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconChartBar, IconScissors } from "@tabler/icons-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { BookingsTab } from "./ot/bookings-tab";
import { PreferencesTab } from "./ot/preferences-tab";
import { OtReportsTab } from "./ot/reports-tab";
import { RoomsTab } from "./ot/rooms-tab";
import { ScheduleTab } from "./ot/schedule-tab";

export function OtPage() {
  useRequirePermission([
    P.OT.BOOKINGS_LIST,
    P.OT.BOOKINGS_CREATE,
    P.OT.ROOMS_LIST,
    P.OT.ROOMS_MANAGE,
    P.OT.PREFERENCES_LIST,
    P.OT.PREFERENCES_MANAGE,
    P.OT.REPORTS_VIEW,
  ]);

  const [searchParams, setSearchParams] = useSearchParams();
  const canListBookings = useHasPermission(P.OT.BOOKINGS_LIST);
  const canCreateBooking = useHasPermission(P.OT.BOOKINGS_CREATE);
  const canViewRooms = useHasPermission(P.OT.ROOMS_LIST);
  const canManageRooms = useHasPermission(P.OT.ROOMS_MANAGE);
  const canViewPrefs = useHasPermission(P.OT.PREFERENCES_LIST);
  const canManagePrefs = useHasPermission(P.OT.PREFERENCES_MANAGE);
  const canViewReports = useHasPermission(P.OT.REPORTS_VIEW);
  const visibleTabs = useMemo(
    () =>
      [
        { value: "schedule", label: "Schedule", visible: canListBookings },
        { value: "bookings", label: "Bookings", visible: canListBookings || canCreateBooking },
        { value: "rooms", label: "Rooms", visible: canViewRooms || canManageRooms },
        {
          value: "preferences",
          label: "Surgeon Preferences",
          visible: canViewPrefs || canManagePrefs,
        },
        { value: "reports", label: "Reports", visible: canViewReports },
      ].filter((tab) => tab.visible),
    [
      canListBookings,
      canCreateBooking,
      canViewRooms,
      canManageRooms,
      canViewPrefs,
      canManagePrefs,
      canViewReports,
    ],
  );
  const defaultTab = visibleTabs[0]?.value ?? "bookings";
  const requestedTab = searchParams.get("tab");
  const selectedTab = visibleTabs.some((tab) => tab.value === requestedTab)
    ? (requestedTab ?? defaultTab)
    : defaultTab;
  const setSelectedTab = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value ?? defaultTab);
    params.delete("action");
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Operation Theatre"
        subtitle="OT booking & surgical management"
        icon={<IconScissors size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <Tabs.List>
          {visibleTabs.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              leftSection={tab.value === "reports" ? <IconChartBar size={16} /> : undefined}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {canListBookings && (
          <Tabs.Panel value="schedule" pt="md">
            <ScheduleTab />
          </Tabs.Panel>
        )}
        {(canListBookings || canCreateBooking) && (
          <Tabs.Panel value="bookings" pt="md">
            <BookingsTab canCreate={canCreateBooking} canList={canListBookings} />
          </Tabs.Panel>
        )}
        {(canViewRooms || canManageRooms) && (
          <Tabs.Panel value="rooms" pt="md">
            <RoomsTab canManage={canManageRooms} />
          </Tabs.Panel>
        )}
        {(canViewPrefs || canManagePrefs) && (
          <Tabs.Panel value="preferences" pt="md">
            <PreferencesTab canManage={canManagePrefs} />
          </Tabs.Panel>
        )}
        {canViewReports && (
          <Tabs.Panel value="reports" pt="md">
            <OtReportsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ── Schedule Tab ───────────────────────────────────────

// ── Booking Detail (Tabbed Surgical Workflow) ──────────

// ── Overview Sub-Tab ──────────────────────────────────

// ── Pre-Op Sub-Tab ────────────────────────────────────

// ── Case Record Sub-Tab ───────────────────────────────

// ── Preferences Tab ────────────────────────────────────

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Consumables Sub-Tab
// ══════════════════════════════════════════════════════════

// OT consumables/implants are recorded through the shared
// PatientConsumablesPanel: picked from the store catalog, they decrement
// real stock and post a chargeable line. Scoped to this booking; when the
// surgery is tied to an admission the charge rolls up onto the
// consolidated discharge bill.

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Reports Tab (Utilization)
// ══════════════════════════════════════════════════════════
