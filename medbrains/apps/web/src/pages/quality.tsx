import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconAward,
  IconChartBar,
  IconClipboardCheck,
  IconFileDescription,
  IconShieldCheck,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AccreditationTab } from "./quality/accreditation-tab";
import { AnalyticsReviewsTab } from "./quality/analytics-reviews-tab";
import { AuditsTab } from "./quality/audits-tab";
import { CommitteesTab } from "./quality/committees-tab";
import { DocumentsTab } from "./quality/documents-tab";
import { IncidentsTab } from "./quality/incidents-tab";
import { IndicatorsTab } from "./quality/indicators-tab";
import classes from "./quality.module.scss";

// ── Color Maps ──────────────────────────────────────────

// Dropdown options for categorical fields
// ── Indicators Tab ──────────────────────────────────────

export function QualityPage() {
  useRequirePermission(P.QUALITY.INDICATORS_LIST);

  return (
    <div className={classes.qualityPage}>
      <PageHeader
        title="Quality Management"
        subtitle="Indicators, documents, incidents, committees, accreditation, and audits"
        icon={<IconShieldCheck size={20} stroke={1.5} />}
        color="teal"
      />

      <Tabs defaultValue="indicators" mt="md">
        <Tabs.List>
          <Tabs.Tab value="indicators" leftSection={<IconChartBar size={16} />}>
            Indicators
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileDescription size={16} />}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>
            Incidents
          </Tabs.Tab>
          <Tabs.Tab value="committees" leftSection={<IconUsers size={16} />}>
            Committees
          </Tabs.Tab>
          <Tabs.Tab value="accreditation" leftSection={<IconAward size={16} />}>
            Accreditation
          </Tabs.Tab>
          <Tabs.Tab value="audits" leftSection={<IconClipboardCheck size={16} />}>
            Audits
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconTrendingUp size={16} />}>
            Analytics & Reviews
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="indicators" pt="md">
          <IndicatorsTab />
        </Tabs.Panel>
        <Tabs.Panel value="documents" pt="md">
          <DocumentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md">
          <IncidentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="committees" pt="md">
          <CommitteesTab />
        </Tabs.Panel>
        <Tabs.Panel value="accreditation" pt="md">
          <AccreditationTab />
        </Tabs.Panel>
        <Tabs.Panel value="audits" pt="md">
          <AuditsTab />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsReviewsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
