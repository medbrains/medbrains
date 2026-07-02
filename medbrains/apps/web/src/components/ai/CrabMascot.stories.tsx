import type { Meta, StoryObj } from "@storybook/react-vite";
import { CrabLottie } from "./CrabLottie";
import { CrabMascot, type CrabPose } from "./CrabMascot";

const meta = {
  title: "AI/Crab mascot",
  component: CrabMascot,
  tags: ["autodocs"],
} satisfies Meta<typeof CrabMascot>;
export default meta;

type Story = StoryObj<typeof CrabMascot>;

const POSES: CrabPose[] = ["greet", "think", "explain", "analyze", "diagnose"];

export const Poses: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
      {POSES.map((pose) => (
        <div key={pose} style={{ textAlign: "center" }}>
          <CrabMascot size={120} pose={pose} />
          <div style={{ fontSize: 12, color: "#5b6472", marginTop: 8 }}>{pose}</div>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
      {[128, 72, 48, 32, 20].map((size) => (
        <CrabMascot key={size} size={size} pose="explain" animate={false} />
      ))}
    </div>
  ),
};

export const Reversed: Story = {
  render: () => (
    <div style={{ background: "#0f62fe", padding: 32, borderRadius: 16, width: "fit-content" }}>
      <CrabMascot size={140} pose="greet" reversed />
    </div>
  ),
};

export const Animated: Story = {
  name: "Animated (Lottie)",
  render: () => <CrabLottie size={200} />,
};
