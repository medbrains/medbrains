import { Group } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { PrintRegisterButton } from "@/components/Print/PrintRegisterButton";
import { Button } from "@/components/ui";

interface ChecklistsHeaderActionsProps {
  canCreate: boolean;
  onCreate: () => void;
}

/** The checklists header: the yearly NMC compliance return, then "New Checklist". */
export function ChecklistsHeaderActions({ canCreate, onCreate }: ChecklistsHeaderActionsProps) {
  return (
    <Group gap="xs">
      <PrintRegisterButton documentKey="nmc-compliance-report" period="year" />
      {canCreate && (
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={onCreate}>
          New Checklist
        </Button>
      )}
    </Group>
  );
}
