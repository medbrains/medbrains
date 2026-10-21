import { Box, Collapse, Tabs, Text } from "@mantine/core";
import {
  IconArrowRight,
  IconCalendarPlus,
  IconCertificate,
  IconChartLine,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconFileCheck,
  IconFlask,
  IconHeartbeat,
  IconHistory,
  IconMedicalCross,
  IconMessage,
  IconNotebook,
  IconPill,
  IconShieldCheck,
  IconStar,
  IconStethoscope,
  IconTimeline,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui";
import styles from "../opd-encounter.module.scss";

interface NavTab {
  value: string;
  icon: ReactNode;
  label: string;
}

interface NavSection {
  label: string;
  tabs: NavTab[];
}

/** What a doctor works through in a visit, in the order they work. */
const VISIT_SECTIONS: NavSection[] = [
  {
    label: "Workup",
    tabs: [
      { value: "vitals", icon: <IconHeartbeat size={16} />, label: "Vitals" },
      { value: "consultation", icon: <IconNotebook size={16} />, label: "Consultation" },
      { value: "history", icon: <IconHistory size={16} />, label: "History" },
      { value: "ros", icon: <IconClipboardList size={16} />, label: "ROS" },
      { value: "physical-exam", icon: <IconStethoscope size={16} />, label: "Physical Exam" },
    ],
  },
  {
    label: "Assessment & orders",
    tabs: [
      { value: "diagnoses", icon: <IconStar size={16} />, label: "Diagnoses" },
      { value: "investigations", icon: <IconFlask size={16} />, label: "Investigations" },
      { value: "procedures", icon: <IconMedicalCross size={16} />, label: "Procedures" },
      { value: "prescriptions", icon: <IconPill size={16} />, label: "Prescriptions" },
      { value: "referrals", icon: <IconArrowRight size={16} />, label: "Referrals" },
      { value: "specialty", icon: <IconStethoscope size={16} />, label: "Specialty" },
    ],
  },
  {
    label: "Close the visit",
    tabs: [
      { value: "followup", icon: <IconCalendarPlus size={16} />, label: "Follow-up" },
      { value: "certificates", icon: <IconCertificate size={16} />, label: "Certificates" },
    ],
  },
];

/** Reference and desk work: one click away, not in the doctor's path. */
const MORE_TABS: NavTab[] = [
  { value: "charts", icon: <IconChartLine size={16} />, label: "Charts" },
  { value: "timeline", icon: <IconTimeline size={16} />, label: "Timeline" },
  { value: "reminders", icon: <IconNotebook size={16} />, label: "Reminders" },
  { value: "consents", icon: <IconFileCheck size={16} />, label: "Consents" },
  { value: "pre-auth", icon: <IconShieldCheck size={16} />, label: "Pre-Auth" },
  { value: "docket", icon: <IconStar size={16} />, label: "Docket" },
  { value: "feedback", icon: <IconMessage size={16} />, label: "Feedback" },
];

interface EncounterNavProps {
  activeTab: string;
  /** Whether the caller may open a tab; a tab they may not is not shown. */
  isTabAllowed: (value: string) => boolean;
}

function NavList({ tabs }: { tabs: NavTab[] }) {
  return (
    <Tabs.List className={styles.railList}>
      {tabs.map((tab) => (
        <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
          {tab.label}
        </Tabs.Tab>
      ))}
    </Tabs.List>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text fw={700} c="dimmed" tt="uppercase" size="xs" mb={2} px={4} className={styles.railLabel}>
      {children}
    </Text>
  );
}

/** The encounter's left rail: the visit's tabs, then "More" collapsed. */
export function EncounterNav({ activeTab, isTabAllowed }: EncounterNavProps) {
  const more = MORE_TABS.filter((tab) => isTabAllowed(tab.value));
  const activeIsMore = more.some((tab) => tab.value === activeTab);
  const [moreOpen, setMoreOpen] = useState(false);
  // A tab opened from a link stays visible even when "More" was closed.
  const showMore = moreOpen || activeIsMore;

  return (
    <Box className={styles.railNav}>
      {VISIT_SECTIONS.map((section) => {
        const tabs = section.tabs.filter((tab) => isTabAllowed(tab.value));
        if (tabs.length === 0) return null;
        return (
          <Box key={section.label} mb="xs">
            <SectionLabel>{section.label}</SectionLabel>
            <NavList tabs={tabs} />
          </Box>
        );
      })}
      {more.length > 0 && (
        <Box>
          <Button
            tone="ghost"
            size="xs"
            fullWidth
            justify="flex-start"
            leftSection={showMore ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            aria-expanded={showMore}
            onClick={() => setMoreOpen(!showMore)}
          >
            More ({more.length})
          </Button>
          <Collapse expanded={showMore}>
            <NavList tabs={more} />
          </Collapse>
        </Box>
      )}
    </Box>
  );
}
