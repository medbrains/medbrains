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
    trend: { value: 12, label: "vs yesterday" },
  },
};

export const CriticalAlerts: Story = {
  args: {
    label: "Critical alerts",
    value: 17,
    icon: <IconAlertTriangle size={18} />,
    color: "danger",
    trend: { value: 23, label: "since 22:00" },
  },
};

export const BedOccupancy: Story = {
  args: {
    label: "ICU occupancy",
    value: "86%",
    icon: <IconBed size={18} />,
    color: "mint",
    trend: { value: -4, label: "vs morning" },
  },
};

export const Revenue: Story = {
  args: {
    label: "Today's revenue",
    value: "₹4.2m",
    icon: <IconCash size={18} />,
    color: "violet",
    trend: { value: 8 },
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
        trend={{ value: 12 }}
      />
      <StatCard
        label="Critical ICU"
        value={17}
        icon={<IconAlertTriangle size={18} />}
        color="danger"
        trend={{ value: 23 }}
      />
      <StatCard
        label="ICU occupancy"
        value="86%"
        icon={<IconBed size={18} />}
        color="mint"
        trend={{ value: -4 }}
      />
      <StatCard
        label="Revenue ₹"
        value="4.2m"
        icon={<IconCash size={18} />}
        color="violet"
        trend={{ value: 8 }}
      />
      <StatCard
        label="Active staff"
        value={86}
        icon={<IconHeartbeat size={18} />}
        color="info"
        trend={{ value: 4 }}
      />
      <StatCard
        label="Avg wait"
        value="4:23"
        icon={<IconActivity size={18} />}
        color="warning"
        trend={{ value: -18 }}
      />
    </SimpleGrid>
  ),
};
