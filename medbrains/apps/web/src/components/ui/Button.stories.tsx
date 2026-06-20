import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconPlus } from "@tabler/icons-react";
import { Button, type ButtonTone } from "./Button";

const TONES: ButtonTone[] = ["primary", "secondary", "ghost", "danger", "subtle-danger"];

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {TONES.map((tone) => (
        <Button key={tone} tone={tone}>
          {tone}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Button key={size} tone="primary" size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: { tone: "primary", leftSection: <IconPlus size={16} />, children: "Add patient" },
};

export const Loading: Story = { args: { tone: "primary", loading: true, children: "Saving" } };

export const Disabled: Story = { args: { tone: "primary", disabled: true, children: "Disabled" } };
