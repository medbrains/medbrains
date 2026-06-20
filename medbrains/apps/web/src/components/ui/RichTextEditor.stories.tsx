import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";

const meta = {
  title: "Primitives/RichTextEditor",
  component: RichTextEditor,
  tags: ["autodocs"],
} satisfies Meta<typeof RichTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

function Controlled() {
  const [value, setValue] = useState(
    "<h3>Clinical note</h3><p>Patient is <strong>stable</strong>. Continue current plan.</p><ul><li>Vitals normal</li><li>Review in 1 week</li></ul>",
  );
  return (
    <div style={{ maxWidth: 640 }}>
      <RichTextEditor value={value} onChange={setValue} ariaLabel="Clinical note" />
    </div>
  );
}

export const Default: Story = { render: () => <Controlled /> };
export const ReadOnly: Story = {
  args: {
    readOnly: true,
    ariaLabel: "Discharge summary",
    value: "<h3>Discharge summary</h3><p>Discharged in good condition.</p>",
  },
};
