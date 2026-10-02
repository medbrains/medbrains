import { SimpleGrid } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IconActivity,
  IconAlertTriangle,
  IconBed,
  IconCash,
  IconHeartbeat,
  IconStethoscope,
} from "@tabler/icons-react";
import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  parameters: { layout: "centered" },
  argTypes: {
    color: {
      control: "select",
      options: [
        "primary",
        "blue",
        "cinnabar",
        "mint",
        "success",
        "warning",
        "danger",
        "info",
        "violet",
        "orange",
      ],
    },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Patients seen",
    value: 247,
    icon: <IconStethoscope size={18} />,
    color: "primary",
    comparison: { text: "12% higher vs yesterday", tone: "neutral", direction: "up" },
  },
};

export const CriticalAlerts: Story = {
  args: {
    label: "Critical alerts",
    value: 17,
    icon: <IconAlertTriangle size={18} />,
    color: "danger",
    comparison: { text: "23% higher since 22:00", tone: "neutral", direction: "up" },
  },
};

export const BedOccupancy: Story = {
  args: {
    label: "ICU occupancy",
    value: "86%",
    icon: <IconBed size={18} />,
    color: "mint",
    comparison: { text: "4% lower vs morning", tone: "neutral", direction: "down" },
  },
};

export const Revenue: Story = {
  args: {
    label: "Today's revenue",
    value: "₹4.2m",
    icon: <IconCash size={18} />,
    color: "violet",
    comparison: { text: "8% higher", tone: "neutral", direction: "up" },
  },
};

export const NoTrend: Story = {
  args: {
    label: "Active doctors",
    value: 12,
    icon: <IconHeartbeat size={18} />,
    color: "primary",
  },
};

export const FullDashboardGrid: Story = {
  args: {} as never,
  render: () => (
    <SimpleGrid cols={{ base: 2, md: 3, lg: 6 }} spacing="md" w="100%" maw={1200}>
      <StatCard
        label="Patients OPD"
        value={247}
        icon={<IconStethoscope size={18} />}
        color="primary"
        comparison={{ text: "12% higher", tone: "neutral", direction: "up" }}
      />
      <StatCard
        label="Critical ICU"
        value={17}
        icon={<IconAlertTriangle size={18} />}
        color="danger"
        comparison={{ text: "23% higher", tone: "neutral", direction: "up" }}
      />
      <StatCard
        label="ICU occupancy"
        value="86%"
        icon={<IconBed size={18} />}
        color="mint"
        comparison={{ text: "4% lower", tone: "neutral", direction: "down" }}
      />
      <StatCard
        label="Revenue ₹"
        value="4.2m"
        icon={<IconCash size={18} />}
        color="violet"
        comparison={{ text: "8% higher", tone: "neutral", direction: "up" }}
      />
      <StatCard
        label="Active staff"
        value={86}
        icon={<IconHeartbeat size={18} />}
        color="info"
        comparison={{ text: "4% higher", tone: "neutral", direction: "up" }}
      />
      <StatCard
        label="Avg wait"
        value="4:23"
        icon={<IconActivity size={18} />}
        color="warning"
        comparison={{ text: "18% lower", tone: "neutral", direction: "down" }}
      />
    </SimpleGrid>
  ),
};
