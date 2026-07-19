// Emergency EmergencyVisitContextRail — split from emergency.tsx (pure move).

import { Box, Divider, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ErVisit } from "@medbrains/types";
import {
  IconBuildingHospital,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconUrgent,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui";
import classes from "../emergency.module.scss";
import { EmergencyVisitSignals, VisitSummaryValue } from "./shared";

export function EmergencyVisitContextRail({
  visit,
  canShowTriage,
  canShowResuscitation,
  canShowMlc,
}: {
  visit: ErVisit;
  canShowTriage: boolean;
  canShowResuscitation: boolean;
  canShowMlc: boolean;
}) {
  const { t } = useTranslation("emergency");
  const navigate = useNavigate();

  return (
    <Box className={classes.contextRail}>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("workspace.title")}
          </Text>
          <Text size="sm" fw={700}>
            {visit.visit_number}
          </Text>
        </Stack>
        <EmergencyVisitSignals visit={visit} />
        <Divider />
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("workspace.navigate")}
          </Text>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconHeartbeat size={14} />}
            component="a"
            href="#er-triage"
            disabled={!canShowTriage}
            fullWidth
          >
            {t("workspace.triage")}
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconFirstAidKit size={14} />}
            component="a"
            href="#er-resuscitation"
            disabled={!canShowResuscitation}
            fullWidth
          >
            {t("workspace.resuscitation")}
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconUrgent size={14} />}
            onClick={() => navigate("/emergency?tab=visits")}
            fullWidth
          >
            {t("workspace.erQueue")}
          </Button>
          {visit.is_mlc && (
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconGavel size={14} />}
              component="a"
              href="#mlc"
              disabled={!canShowMlc}
              fullWidth
            >
              {t("workspace.mlcCase")}
            </Button>
          )}
          {visit.admission_id && (
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={() => navigate(`/ipd/admissions/${visit.admission_id}#overview`)}
              fullWidth
            >
              {t("workspace.ipdAdmission")}
            </Button>
          )}
        </Stack>
        <Divider />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 1 }}>
          <VisitSummaryValue
            label={t("summary.arrival")}
            value={new Date(visit.arrival_time).toLocaleString()}
          />
          <VisitSummaryValue label={t("summary.mode")} value={visit.arrival_mode ?? "---"} />
          <VisitSummaryValue label={t("summary.bay")} value={visit.bay_number ?? "---"} />
          <VisitSummaryValue
            label={t("summary.chiefComplaint")}
            value={visit.chief_complaint ?? "---"}
          />
          <VisitSummaryValue label={t("summary.disposition")} value={visit.disposition ?? "---"} />
          <VisitSummaryValue
            label={t("summary.doorToDoctor")}
            value={
              visit.door_to_doctor_mins !== null
                ? t("summary.minutes", { minutes: visit.door_to_doctor_mins })
                : t("summary.pending")
            }
          />
          <VisitSummaryValue
            label={t("summary.doorToDisposition")}
            value={
              visit.door_to_disposition_mins !== null
                ? t("summary.minutes", { minutes: visit.door_to_disposition_mins })
                : t("summary.pending")
            }
          />
          <VisitSummaryValue
            label={t("summary.admission")}
            value={visit.admission_id ? t("signals.ipdAdmission") : "---"}
          />
        </SimpleGrid>
        {visit.notes && (
          <Paper withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("summary.notes")}
            </Text>
            <Text size="sm">{visit.notes}</Text>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
