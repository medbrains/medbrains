import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCertificate,
  IconMail,
  IconMoodSad,
  IconSettings,
  IconStar,
  IconStethoscope,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AlertsTab } from "./communications/alerts-tab";
import { ClinicalTab } from "./communications/clinical-tab";
import { ComplaintsTab } from "./communications/complaints-tab";
import { ConfigTab } from "./communications/config-tab";
import { DltTab } from "./communications/dlt-tab";
import { FeedbackTab } from "./communications/feedback-tab";
import { MessagesTab } from "./communications/messages-tab";

export function CommunicationsPage() {
  useRequirePermission(P.COMMUNICATIONS.MESSAGES_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("messages");

  return (
    <div>
      <PageHeader
        title="Communication Hub"
        subtitle="Messages, clinical comms, alerts, complaints & feedback"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="messages" leftSection={<IconMail size={16} />}>
            Messages
          </Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
            Clinical
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
            Alerts
          </Tabs.Tab>
          <Tabs.Tab value="complaints" leftSection={<IconMoodSad size={16} />}>
            Complaints
          </Tabs.Tab>
          <Tabs.Tab value="feedback" leftSection={<IconStar size={16} />}>
            Feedback
          </Tabs.Tab>
          <Tabs.Tab value="dlt" leftSection={<IconCertificate size={16} />}>
            DLT
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>
            Config
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="messages" pt="md">
          <MessagesTab />
        </Tabs.Panel>
        <Tabs.Panel value="clinical" pt="md">
          <ClinicalTab />
        </Tabs.Panel>
        <Tabs.Panel value="alerts" pt="md">
          <AlertsTab />
        </Tabs.Panel>
        <Tabs.Panel value="complaints" pt="md">
          <ComplaintsTab />
        </Tabs.Panel>
        <Tabs.Panel value="feedback" pt="md">
          <FeedbackTab />
        </Tabs.Panel>
        <Tabs.Panel value="dlt" pt="md">
          <DltTab />
        </Tabs.Panel>
        <Tabs.Panel value="config" pt="md">
          <ConfigTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
