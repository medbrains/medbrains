/**
 * The left side of the sign-in page: what MedBrains is, in four points, on
 * the brand's deep navy (fixed in both colour schemes, like the website's
 * hero). Every claim here is true of the product today.
 */
import { Box, Group, Stack, Text } from "@mantine/core";
import {
  IconDeviceMobile,
  IconLockSquareRounded,
  IconShieldCheck,
  IconUserCheck,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { HealthTipsSlider } from "@/components/HealthTipsSlider";
import { Image } from "@/components/ui";
import classes from "./sign-in-stage.module.scss";

interface Point {
  icon: ReactNode;
  title: string;
  body: string;
}

const POINTS: Point[] = [
  {
    icon: <IconUserCheck size={20} />,
    title: "One patient, one record",
    body: "A UHID at the front desk and the same chart in OPD, wards, lab, pharmacy and billing.",
  },
  {
    icon: <IconShieldCheck size={20} />,
    title: "The rules are in the screens",
    body: "NABH workflows, Schedule H and NDPS at the counter, and every access on record.",
  },
  {
    icon: <IconDeviceMobile size={20} />,
    title: "Web and native apps",
    body: "Staff and patient apps for iPhone and Android, token boards for the waiting room.",
  },
  {
    icon: <IconLockSquareRounded size={20} />,
    title: "Your hospital's data, sealed",
    body: "Each hospital is isolated in the database itself, and its data is kept in India.",
  },
];

export function SignInStage() {
  return (
    <Box component="aside" className={classes.stage} aria-label="About MedBrains">
      <Stack gap={32} className={classes.inner}>
        <Group gap={12}>
          <Image
            src="/logo/medbrains-mark.svg"
            alt=""
            w={36}
            h={36}
            fit="contain"
            radius={2}
            loading="eager"
          />
          <Text className={classes.brand} c="var(--mb-stage-text)">
            MedBrains
          </Text>
        </Group>

        <Stack gap={14}>
          <Text className={classes.eyebrow} c="var(--mb-stage-sky)">
            For Indian hospitals · NABH · ABDM
          </Text>
          <Text component="h2" className={classes.title} c="var(--mb-stage-text)">
            The whole hospital. <span className={classes.gradient}>One system.</span>
          </Text>
          <Text className={classes.lede} c="var(--mb-stage-text-muted)">
            From the front desk to the discharge summary — OPD, wards, lab, pharmacy and billing,
            with every rule built in.
          </Text>
        </Stack>

        <Stack gap={18} component="ul" className={classes.points}>
          {POINTS.map((p) => (
            <Group key={p.title} component="li" gap={14} wrap="nowrap" align="flex-start">
              <Box className={classes.icon} aria-hidden>
                {p.icon}
              </Box>
              <Stack gap={2}>
                <Text className={classes.pointTitle} c="var(--mb-stage-text)">
                  {p.title}
                </Text>
                <Text className={classes.pointBody} c="var(--mb-stage-text-muted)">
                  {p.body}
                </Text>
              </Stack>
            </Group>
          ))}
        </Stack>

        <Box className={classes.tip}>
          <HealthTipsSlider />
        </Box>
      </Stack>
    </Box>
  );
}
