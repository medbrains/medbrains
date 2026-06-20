import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, type AlertTone } from "./Alert";

const TONES: AlertTone[] = ["info", "success", "warning", "danger", "neutral"];

const meta = {
  title: "Primitives/Alert",
  component: Alert,
  tags: ["autodocs"],
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
      {TONES.map((tone) => (
        <Alert key={tone} tone={tone} title={`${tone} alert`}>
          This is a {tone} message with a tone icon and a clear hierarchy.
        </Alert>
      ))}
    </div>
  ),
};
