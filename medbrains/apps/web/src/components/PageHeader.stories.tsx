import { Button, Group } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IconDownload,
  IconHeartbeat,
  IconPlus,
  IconStethoscope,
  IconUserPlus,
} from "@tabler/icons-react";
import { PageHeader } from "./PageHeader";

const meta = {
  title: "Components/PageHeader",
  component: PageHeader,
  parameters: { layout: "fullscreen" },
  argTypes: {
    color: {
      control: "select",
      options: [
        undefined,
        "primary",
        "blue",
        "cinnabar",
        "mint",
        "success",
        "warning",
        "danger",
        "info",
        "violet",
      ],
    },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Outpatient queue",
    subtitle: "Today · 247 patients · avg wait 4:23",
    icon: <IconStethoscope size={18} />,
  },
};

export const WithDescription: Story = {
  args: {
    title: "ICU board",
    subtitle: "Real-time vitals",
    description:
      "Live monitor of every active ICU patient. Hover any row to see last 12 hours of vitals.",
    icon: <IconHeartbeat size={18} />,
    color: "danger",
  },
};

export const WithBreadcrumbsAndActions: Story = {
  args: {
    title: "Pharmacy dispensing",
    subtitle: "Active queue · 12 prescriptions",
    icon: <IconStethoscope size={18} />,
    color: "violet",
    breadcrumbs: [
      { label: "Dashboard", href: "/" },
      { label: "Pharmacy", href: "/pharmacy" },
      { label: "Dispensing" },
    ],
    actions: (
      <Group gap="xs">
        <Button variant="default" size="sm" leftSection={<IconDownload size={14} />}>
          Export
        </Button>
        <Button size="sm" leftSection={<IconPlus size={14} />}>
          New prescription
        </Button>
      </Group>
    ),
  },
};

export const FullEditorial: Story = {
  args: {
    title: "Friday census",
    subtitle: "29 May · 22:14 IST",
    description: "12 doctors on floor · avg wait 4:23 · 247 patients seen today",
    icon: <IconHeartbeat size={18} />,
    color: "primary",
    breadcrumbs: [{ label: "Dashboard" }],
    actions: (
      <Group gap="xs">
        <Button variant="default" size="sm">
          Export
        </Button>
        <Button size="sm" leftSection={<IconUserPlus size={14} />}>
          Begin admission
        </Button>
      </Group>
    ),
  },
};
