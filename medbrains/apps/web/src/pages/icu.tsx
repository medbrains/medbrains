import { AnalyticsTab } from "./icu/analytics-tab";
import { DevicesTab } from "./icu/devices-tab";
import { FlowsheetsTab } from "./icu/flowsheets-tab";
import { NeonatalTab } from "./icu/neonatal-tab";
import { NutritionTab } from "./icu/nutrition-tab";
import { ScoresTab } from "./icu/scores-tab";
import { VentilatorTab } from "./icu/ventilator-tab";
import "@mantine/charts/styles.css";
import { Tabs, TextInput } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconBabyCarriage,
  IconChartBar,
  IconHeartbeat,
  IconLungs,
  IconReportMedical,
  IconStethoscope,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";

// ── Shared admission selector ──────────────────────────────

function AdmissionSelector({
  admissionId,
  onChange,
}: {
  admissionId: string;
  onChange: (id: string) => void;
}) {
  return (
    <TextInput
      label="Admission ID"
      placeholder="Enter IPD admission ID"
      value={admissionId}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{ maxWidth: 400 }}
    />
  );
}

// ── Score type labels ────────────────────────────────────────

// ── Hemodynamic Trends Chart ─────────────────────────────────

// ── Infusion Tracker ─────────────────────────────────────────

// ── Flowsheets Tab ──────────────────────────────────────────

// ── Scores Tab ──────────────────────────────────────────────

// ── Neonatal Tab ────────────────────────────────────────────

export function IcuPage() {
  useRequirePermission(P.ICU.FLOWSHEETS_LIST);

  const [admissionId, setAdmissionId] = useState("");

  return (
    <div>
      <PageHeader
        title="ICU / Critical Care"
        subtitle="Flowsheets, ventilator management, scoring, device tracking, nutrition, and NICU"
      />

      <AdmissionSelector admissionId={admissionId} onChange={setAdmissionId} />

      <Tabs defaultValue="flowsheets" mt="md">
        <Tabs.List>
          <Tabs.Tab value="flowsheets" leftSection={<IconHeartbeat size={16} />}>
            Flowsheets
          </Tabs.Tab>
          <Tabs.Tab value="ventilator" leftSection={<IconLungs size={16} />}>
            Ventilator
          </Tabs.Tab>
          <Tabs.Tab value="scores" leftSection={<IconReportMedical size={16} />}>
            Scores
          </Tabs.Tab>
          <Tabs.Tab value="devices" leftSection={<IconStethoscope size={16} />}>
            Devices
          </Tabs.Tab>
          <Tabs.Tab value="nutrition" leftSection={<IconToolsKitchen2 size={16} />}>
            Nutrition
          </Tabs.Tab>
          <Tabs.Tab value="nicu" leftSection={<IconBabyCarriage size={16} />}>
            NICU
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="flowsheets" pt="md">
          <FlowsheetsTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="ventilator" pt="md">
          <VentilatorTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="scores" pt="md">
          <ScoresTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="devices" pt="md">
          <DevicesTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="nutrition" pt="md">
          <NutritionTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="nicu" pt="md">
          <NeonatalTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
