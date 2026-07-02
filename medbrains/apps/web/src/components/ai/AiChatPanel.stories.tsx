import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiChatPanel } from "./AiChatPanel";

const meta = {
  title: "AI/Chat panel",
  component: AiChatPanel,
  tags: ["autodocs"],
} satisfies Meta<typeof AiChatPanel>;
export default meta;

type Story = StoryObj<typeof AiChatPanel>;

/** The assembled assistant on the mock transport — type a message to see the streamed reply. */
export const Default: Story = {
  args: {
    suggestions: [
      "Summarize this patient's labs",
      "Draft a discharge note",
      "Check drug interactions",
    ],
  },
  render: (args) => (
    <div
      style={{
        width: 440,
        height: 580,
        border: "1px solid var(--mb-border, #e3e8f0)",
        borderRadius: 18,
        overflow: "hidden",
        display: "flex",
      }}
    >
      <AiChatPanel {...args} />
    </div>
  ),
};
