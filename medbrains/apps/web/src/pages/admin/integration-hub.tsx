import { Button, SegmentedControl, Tabs } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconClock,
  IconList,
  IconPlug,
  IconRadar,
  IconRoute,
  IconStack3,
} from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ConnectorsTab,
  ControlRoom,
  EventsTab,
  ExecutionPanel,
  JobsTab,
  PipelineLedger,
  RecipeShelf,
  SchedulesTab,
} from "../../components/Integration";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

type HubView = "ledger" | "recipes" | "control" | "config";

const VIEW_OPTIONS = [
  { label: "Ledger", value: "ledger" },
  { label: "Recipes", value: "recipes" },
  { label: "Control Room", value: "control" },
  { label: "Config", value: "config" },
];

export function IntegrationHubPage() {
  useRequirePermission(P.INTEGRATION.LIST);

  const canCreate = useHasPermission(P.INTEGRATION.CREATE);
  const navigate = useNavigate();

  const [view, setView] = useState<HubView>("ledger");
  const [execPipelineId, setExecPipelineId] = useState<string | null>(null);
  const [execOpened, { open: openExec, close: closeExec }] = useDisclosure(false);

  function handleOpenExecution(pipelineId: string) {
    setExecPipelineId(pipelineId);
    openExec();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <PageHeader
        title="Automation Hub"
        subtitle="Orchestrate workflows across every module"
        actions={
          <>
            {canCreate && (
              <Button
                size="xs"
                leftSection={<IconPlug size={14} />}
                onClick={() => navigate("/admin/integration-builder")}
              >
                New Pipeline
              </Button>
            )}
          </>
        }
      />

      {/* View switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 4px 12px",
        }}
      >
        <SegmentedControl
          size="xs"
          data={VIEW_OPTIONS.map((o) => ({
            label: (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {o.value === "ledger" && <IconList size={13} />}
                {o.value === "recipes" && <IconRoute size={13} />}
                {o.value === "control" && <IconActivity size={13} />}
                {o.value === "config" && <IconStack3 size={13} />}
                {o.label}
              </span>
            ),
            value: o.value,
          }))}
          value={view}
          onChange={(v) => setView(v as HubView)}
        />
      </div>

      {/* View panels */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "ledger" && <PipelineLedger onOpenExecution={handleOpenExecution} />}

        {view === "recipes" && <RecipeShelf />}

        {view === "control" && <ControlRoom />}

        {view === "config" && (
          <Tabs defaultValue="events">
            <Tabs.List mb="md">
              <Tabs.Tab value="events" leftSection={<IconRadar size={14} />}>
                Events
              </Tabs.Tab>
              <Tabs.Tab value="connectors" leftSection={<IconPlug size={14} />}>
                Connectors
              </Tabs.Tab>
              <Tabs.Tab value="jobs" leftSection={<IconStack3 size={14} />}>
                Jobs
              </Tabs.Tab>
              <Tabs.Tab value="schedules" leftSection={<IconClock size={14} />}>
                Schedules
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="events">
              <EventsTab />
            </Tabs.Panel>
            <Tabs.Panel value="connectors">
              <ConnectorsTab />
            </Tabs.Panel>
            <Tabs.Panel value="jobs">
              <JobsTab />
            </Tabs.Panel>
            <Tabs.Panel value="schedules">
              <SchedulesTab />
            </Tabs.Panel>
          </Tabs>
        )}
      </div>

      <ExecutionPanel pipelineId={execPipelineId} opened={execOpened} onClose={closeExec} />
    </div>
  );
}
