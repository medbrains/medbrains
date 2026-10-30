import { Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DentalExam, P } from "@medbrains/types";
import { Modal } from "@/components/ui";
import { ChartTab } from "./ChartTab";
import { PerioTab } from "./PerioTab";
import { TreatmentTab } from "./TreatmentTab";

/** One dental visit: the tooth chart and the treatment plan. */
export function ExamDrawer({ exam, onClose }: { exam: DentalExam | null; onClose: () => void }) {
  const canSeePlan = useHasPermission(P.SPECIALTY.DENTAL.TREATMENT_LIST);
  const canSeePerio = useHasPermission(P.SPECIALTY.DENTAL.PERIO_LIST);
  return (
    <Modal opened={exam !== null} onClose={onClose} title="Dental exam" fullScreen>
      {exam && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {exam.chief_complaint ?? "Exam"} · {exam.status}
          </Text>
          <Tabs defaultValue="chart">
            <Tabs.List>
              <Tabs.Tab value="chart">Chart</Tabs.Tab>
              {canSeePerio && <Tabs.Tab value="perio">Periodontal</Tabs.Tab>}
              {canSeePlan && <Tabs.Tab value="plan">Treatment plan</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="chart" pt="md">
              <ChartTab examId={exam.id} />
            </Tabs.Panel>
            {canSeePerio && (
              <Tabs.Panel value="perio" pt="md">
                <PerioTab exam={exam} />
              </Tabs.Panel>
            )}
            {canSeePlan && (
              <Tabs.Panel value="plan" pt="md">
                <TreatmentTab examId={exam.id} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      )}
    </Modal>
  );
}
