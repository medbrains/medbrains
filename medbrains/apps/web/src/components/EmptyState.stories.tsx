import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconCalendarOff, IconInbox, IconSearch, IconStethoscope } from "@tabler/icons-react";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAppointments: Story = {
  args: {
    icon: <IconCalendarOff size={32} />,
    title: "No appointments today",
    description:
      "Once doctors begin their morning rounds, today's outpatient queue will appear here in real time.",
    action: {
      label: "Schedule appointment",
      onClick: () => {
        /* showcase only */
      },
    },
  },
};

export const NoSearchResults: Story = {
  args: {
    icon: <IconSearch size={32} />,
    title: "No patients found",
    description: "Try a different UHID, name, or phone number.",
  },
};

export const NoPendingTasks: Story = {
  args: {
    icon: <IconInbox size={32} />,
    title: "Inbox zero",
    description: "All tasks reviewed. Take a moment and check on a colleague.",
  },
};

export const NoVisits: Story = {
  args: {
    icon: <IconStethoscope size={32} />,
    title: "No visits this week",
    description: "Once visits are logged, they'll appear here grouped by department.",
    action: {
      label: "Create first visit",
      onClick: () => {
        /* showcase only */
      },
    },
  },
};
