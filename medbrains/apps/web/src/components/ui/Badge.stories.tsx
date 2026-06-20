import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, type BadgeTone } from "./Badge";

const TONES: BadgeTone[] = ["neutral", "primary", "success", "warning", "danger", "info", "accent"];

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {TONES.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};
