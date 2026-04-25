import { ActionIcon, Stack, Text, TextInput } from "@mantine/core";
import {
  IconClick,
  IconLayout,
  IconPointer,
  IconRocket,
  IconSection,
} from "@tabler/icons-react";
import { useScreenBuilderStore } from "@medbrains/stores";
import { IconPicker } from "./IconPicker";
import { ActionConfig } from "./ActionConfig";
import { SidecarConfig } from "./SidecarConfig";
import { FormZoneConfig } from "./ZoneConfigForms/FormZoneConfig";
import { DataTableZoneConfig } from "./ZoneConfigForms/DataTableZoneConfig";
import { TabsZoneConfig } from "./ZoneConfigForms/TabsZoneConfig";
import { FilterBarZoneConfig } from "./ZoneConfigForms/FilterBarZoneConfig";
import { KanbanZoneConfig } from "./ZoneConfigForms/KanbanZoneConfig";
import { StepperZoneConfig } from "./ZoneConfigForms/StepperZoneConfig";
import { CalendarZoneConfig } from "./ZoneConfigForms/CalendarZoneConfig";
import { InfoPanelZoneConfig } from "./ZoneConfigForms/InfoPanelZoneConfig";
import { DetailHeaderZoneConfig } from "./ZoneConfigForms/DetailHeaderZoneConfig";
import { WidgetGridZoneConfig } from "./ZoneConfigForms/WidgetGridZoneConfig";
import { GenericZoneConfig } from "./ZoneConfigForms/GenericZoneConfig";
import classes from "./screen-builder.module.scss";

function HeaderConfig() {
  const header = useScreenBuilderStore((s) => s.header);
  const breadcrumbs = useScreenBuilderStore((s) => s.breadcrumbs);
  const updateHeader = useScreenBuilderStore((s) => s.updateHeader);
  const updateBreadcrumbs = useScreenBuilderStore((s) => s.updateBreadcrumbs);

  return (
    <Stack gap="sm">
      <div className={classes.propertySectionLabel}>Header</div>
      <TextInput
        label="Title"
        placeholder="Page title"
        value={header.title}
        onChange={(e) => updateHeader({ title: e.currentTarget.value })}
      />
      <TextInput
        label="Subtitle"
        placeholder="Page subtitle"
        value={header.subtitle}
        onChange={(e) => updateHeader({ subtitle: e.currentTarget.value })}
      />
      <IconPicker
        label="Header icon"
        value={header.icon}
        onChange={(icon) => updateHeader({ icon })}
      />

      <div className={classes.propertySectionLabel}>Breadcrumbs</div>
      {breadcrumbs.map((bc, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <TextInput
            size="xs"
            placeholder="Label"
            value={bc.label}
            onChange={(e) => {
              const updated = breadcrumbs.map((b, idx) =>
                idx === i ? { ...b, label: e.currentTarget.value } : b,
              );
              updateBreadcrumbs(updated);
            }}
            style={{ flex: 1 }}
          />
          <TextInput
            size="xs"
            placeholder="/path"
            value={bc.path}
            onChange={(e) => {
              const updated = breadcrumbs.map((b, idx) =>
                idx === i ? { ...b, path: e.currentTarget.value } : b,
              );
              updateBreadcrumbs(updated);
            }}
            style={{ flex: 1 }}
          />
          <ActionIcon
            variant="subtle"
            color="danger"
            size="xs"
            onClick={() => updateBreadcrumbs(breadcrumbs.filter((_, idx) => idx !== i))}
          >
            ×
          </ActionIcon>
        </div>
      ))}
      <Text
        size="xs"
        c="primary"
        style={{ cursor: "pointer" }}
        onClick={() =>
          updateBreadcrumbs([...breadcrumbs, { label: "", path: "" }])
        }
      >
        + Add breadcrumb
      </Text>
    </Stack>
  );
}

function ZoneConfig() {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const zones = useScreenBuilderStore((s) => s.zones);
  const updateZone = useScreenBuilderStore((s) => s.updateZone);

  if (!selectedItemId) return null;
  const zone = zones[selectedItemId];
  if (!zone) return null;

  const renderTypeConfig = () => {
    switch (zone.type) {
      case "form":
        return <FormZoneConfig zone={zone} />;
      case "data_table":
        return <DataTableZoneConfig zone={zone} />;
      case "tabs":
        return <TabsZoneConfig zone={zone} />;
      case "filter_bar":
        return <FilterBarZoneConfig zone={zone} />;
      case "kanban":
        return <KanbanZoneConfig zone={zone} />;
      case "stepper":
        return <StepperZoneConfig zone={zone} />;
      case "calendar":
        return <CalendarZoneConfig zone={zone} />;
      case "info_panel":
        return <InfoPanelZoneConfig zone={zone} />;
      case "detail_header":
        return <DetailHeaderZoneConfig zone={zone} />;
      case "widget_grid":
        return <WidgetGridZoneConfig zone={zone} />;
      default:
        return <GenericZoneConfig zone={zone} />;
    }
  };

  return (
    <Stack gap="sm">
      <div className={classes.propertySectionLabel}>Zone Properties</div>
      <TextInput
        label="Key"
        value={zone.key}
        onChange={(e) => updateZone(zone.clientId, { key: e.currentTarget.value })}
      />
      <TextInput
        label="Label"
        value={zone.label}
        onChange={(e) => updateZone(zone.clientId, { label: e.currentTarget.value })}
      />

      <div className={classes.propertySectionLabel}>Configuration</div>
      {renderTypeConfig()}
    </Stack>
  );
}

function ActionConfigPanel() {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const actions = useScreenBuilderStore((s) => s.actions);

  if (!selectedItemId) return null;
  const action = actions[selectedItemId];
  if (!action) return null;

  return (
    <div>
      <div className={classes.propertySectionLabel}>Action Properties</div>
      <ActionConfig action={action} />
    </div>
  );
}

function SidecarConfigPanel() {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const sidecars = useScreenBuilderStore((s) => s.sidecars);

  if (!selectedItemId) return null;
  const sidecar = sidecars[selectedItemId];
  if (!sidecar) return null;

  return (
    <div>
      <div className={classes.propertySectionLabel}>Sidecar Properties</div>
      <SidecarConfig sidecar={sidecar} />
    </div>
  );
}

export function ScreenPropertyPanel() {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const selectedItemType = useScreenBuilderStore((s) => s.selectedItemType);

  const renderContent = () => {
    if (!selectedItemId || !selectedItemType) {
      return (
        <div className={classes.propertyEmpty}
            aria-label="Pointer">
          <IconPointer size={32} stroke={1} />
          <Text size="sm" c="dimmed">
            Select a zone, action, or sidecar to configure it
          </Text>
        </div>
      );
    }

    switch (selectedItemType) {
      case "header":
        return <HeaderConfig />;
      case "zone":
        return <ZoneConfig />;
      case "action":
        return <ActionConfigPanel />;
      case "sidecar":
        return <SidecarConfigPanel />;
      default:
        return null;
    }
  };

  const panelTitle = () => {
    switch (selectedItemType) {
      case "header":
        return "Header";
      case "zone":
        return "Zone";
      case "action":
        return "Action";
      case "sidecar":
        return "Sidecar";
      default:
        return "Properties";
    }
  };

  const panelIcon = () => {
    switch (selectedItemType) {
      case "header":
        return <IconLayout size={14} />;
      case "zone":
        return <IconSection size={14} />;
      case "action":
        return <IconClick size={14} />;
      case "sidecar":
        return <IconRocket size={14} />;
      default:
        return null;
    }
  };

  return (
    <div className={classes.propertyPanel}>
      <div className={classes.propertyHeader}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {panelIcon()}
          {panelTitle()}
        </span>
      </div>
      <div className={classes.propertyContent}>{renderContent()}</div>
    </div>
  );
}
