/**
 * "Propose change" on the screens that edit knowledge directly (RFC §3.6):
 * opens Admin → Knowledge changes with the editor prefilled, so the change is
 * previewed for who it affects and approved by a second person before it goes
 * live. The direct buttons stay until the direct routes close in a later phase.
 */
import { Group } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { type KnowledgeArea, type KnowledgeChangeOp, P } from "@medbrains/types";
import { IconGitPullRequest, IconPencil, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { Button, IconButton, Tooltip } from "@/components/ui";

const MANAGE: Record<KnowledgeArea, string[]> = {
  drug_interactions: [P.PHARMACY.INTERACTIONS.MANAGE, P.ADMIN.SETTINGS.GENERAL.MANAGE],
  critical_value_rules: [P.LAB.CATALOG.MANAGE, P.ADMIN.SETTINGS.GENERAL.MANAGE],
  flow_switches: [P.FLOWS.SWITCH],
};

/** Drafting a change set needs `create` and the area's manage permission. */
export function useCanPropose(area: KnowledgeArea): boolean {
  const canCreate = useHasPermission(P.KNOWLEDGE.CHANGE_SETS.CREATE);
  const canManage = useHasAnyPermission(MANAGE[area]);
  return canCreate && canManage;
}

function useOpenEditor(area: KnowledgeArea) {
  const navigate = useNavigate();
  return (op: KnowledgeChangeOp, target?: string) =>
    navigate(
      `/admin/knowledge-changes?${new URLSearchParams({ area, op, ...(target ? { target } : {}) })}`,
    );
}

export function ProposeButton({ area }: { area: KnowledgeArea }) {
  const open = useOpenEditor(area);
  return (
    <Button
      tone="secondary"
      size="xs"
      leftSection={<IconGitPullRequest size={16} />}
      onClick={() => open("create")}
    >
      Propose change
    </Button>
  );
}

export function ProposeRowActions({
  area,
  id,
  title,
}: {
  area: KnowledgeArea;
  id: string;
  title: string;
}) {
  const open = useOpenEditor(area);
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Propose a change, with impact preview and approval">
        <IconButton
          tone="default"
          size="sm"
          aria-label={`Propose changing ${title}`}
          onClick={() => open("update", id)}
        >
          <IconPencil size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Propose removing it, with impact preview and approval">
        <IconButton
          tone="default"
          size="sm"
          aria-label={`Propose removing ${title}`}
          onClick={() => open("delete", id)}
        >
          <IconTrash size={16} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}
