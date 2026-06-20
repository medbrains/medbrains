import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";
import { TokenDashboard, type TokenItem } from "./TokenDashboard";

const opd: TokenItem[] = [
  {
    id: "1",
    tokenNumber: "T-014",
    status: "In progress",
    tone: "info",
    primary: "Room 3 · Dr. Rao",
    meta: "Dermatology",
    active: true,
  },
  {
    id: "2",
    tokenNumber: "T-015",
    status: "Called",
    tone: "warning",
    primary: "Room 1 · Dr. Iyer",
    meta: "General Medicine",
  },
  {
    id: "3",
    tokenNumber: "T-016",
    status: "Waiting",
    tone: "neutral",
    primary: "—",
    meta: "Walk-in · ~8 min",
  },
  {
    id: "4",
    tokenNumber: "T-017",
    status: "Waiting",
    tone: "neutral",
    primary: "—",
    meta: "Follow-up",
  },
];

const pharmacy: TokenItem[] = [
  {
    id: "1",
    tokenNumber: "P-21",
    status: "Dispensing",
    tone: "info",
    primary: "Counter 2",
    meta: "3 items",
    active: true,
  },
  {
    id: "2",
    tokenNumber: "P-22",
    status: "Ready",
    tone: "success",
    primary: "Counter 1",
    meta: "1 item · ~2 min",
  },
  {
    id: "3",
    tokenNumber: "P-23",
    status: "Waiting",
    tone: "neutral",
    primary: "—",
    meta: "5 items",
  },
];

const meta = {
  title: "Primitives/TokenDashboard",
  component: TokenDashboard,
  tags: ["autodocs"],
} satisfies Meta<typeof TokenDashboard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OPD: Story = {
  args: { title: "OPD Queue", tokens: opd, headerRight: <Badge tone="success">Live</Badge> },
};
export const Pharmacy: Story = {
  args: { title: "Pharmacy", tokens: pharmacy, headerRight: <Badge tone="success">Live</Badge> },
};
export const Empty: Story = { args: { title: "Lab Counter 2", tokens: [] } };
