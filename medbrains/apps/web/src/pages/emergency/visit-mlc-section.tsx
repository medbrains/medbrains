import { Box, Group, Stack, Text } from "@mantine/core";
import type { MlcCase } from "@medbrains/types";
import { IconAlertTriangle, IconGavel } from "@tabler/icons-react";
import { Alert } from "@/components/ui";
import { MlcCaseDetail } from "./mlc-case-detail";

/** The registered MLC case's workspace on an ER visit, shown once the visit is an MLC. */
export function VisitMlcSection({
  canViewPatientRecord,
  cases,
  loading,
}: {
  canViewPatientRecord: boolean;
  cases: MlcCase[];
  loading: boolean;
}) {
  return (
    <Box id="mlc">
      <Stack>
        <Group gap="xs">
          <IconGavel size={18} />
          <Text fw={700}>MLC case workspace</Text>
        </Group>
        {loading && (
          <Text size="sm" c="dimmed">
            Loading MLC case...
          </Text>
        )}
        {!loading &&
          cases.map((mlcCase) => (
            <MlcCaseDetail
              key={mlcCase.id}
              mlcCase={mlcCase}
              canViewPatientRecord={canViewPatientRecord}
            />
          ))}
        {!loading && cases.length === 0 && (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            This visit is flagged as MLC, but no linked MLC case is available for your current role.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
