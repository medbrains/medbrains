import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input, NumberField, PasswordField, TextArea } from "./Input";

const meta = {
  title: "Primitives/Input",
  component: Input,
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { label: "Full name", placeholder: "Jane Doe" } };
export const WithError: Story = {
  args: { label: "Phone", placeholder: "98xxxxxxxx", error: "Enter a valid 10-digit number" },
};
export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}>
      <Input label="Text" placeholder="UHID, name, or phone" />
      <NumberField label="Age" placeholder="0" />
      <PasswordField label="Password" placeholder="••••••••" />
      <TextArea label="Notes" placeholder="Clinical notes…" />
    </div>
  ),
};
