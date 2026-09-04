import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconCalendar, IconChartBar, IconEye, IconRadar } from "@tabler/icons-react";
import { useSearchParams } from "react-router";
import { ClinicalEventProvider } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AppointmentsTab } from "./radiology/appointments-tab";
import { DicomStudiesTab } from "./radiology/dicom-studies-tab";
import { ModalitiesTab } from "./radiology/modalities-tab";
import { RadiologyOrdersTab } from "./radiology/radiology-orders-tab";
import { TatAnalyticsTab } from "./radiology/tat-analytics-tab";

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function RadiologyPage() {
  useRequirePermission(P.RADIOLOGY.ORDERS_LIST);
  // Addressable so a link can land on a tab. Radiology has no per-study route
  // — it is tabs over a drawer — so this plus ?order_id= is how a study is
  // reached from a patient's chart.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "orders";

  return (
    <ClinicalEventProvider moduleCode="radiology" contextCode="radiology-orders">
      <Tabs
        value={activeTab}
        onChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value) {
            next.set("tab", value);
          } else {
            next.delete("tab");
          }
          // Leaving the orders tab drops the study the drawer was opened for,
          // so a stale order_id cannot reopen it on the way back.
          if (value !== "orders") {
            next.delete("order_id");
          }
          setSearchParams(next, { replace: true });
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="orders" leftSection={<IconRadar size={16} />}>
            Orders
          </Tabs.Tab>
          <Tabs.Tab value="modalities">Modalities</Tabs.Tab>
          <Tabs.Tab value="appointments" leftSection={<IconCalendar size={16} />}>
            Appointments
          </Tabs.Tab>
          <Tabs.Tab value="dicom" leftSection={<IconEye size={16} />}>
            DICOM Studies
          </Tabs.Tab>
          <Tabs.Tab value="tat" leftSection={<IconChartBar size={16} />}>
            TAT Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="orders" pt="md">
          <RadiologyOrdersTab />
        </Tabs.Panel>
        <Tabs.Panel value="modalities" pt="md">
          <ModalitiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="appointments" pt="md">
          <AppointmentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="dicom" pt="md">
          <DicomStudiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="tat" pt="md">
          <TatAnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </ClinicalEventProvider>
  );
}
