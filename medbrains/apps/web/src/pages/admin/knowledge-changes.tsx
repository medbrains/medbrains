/**
 * Admin → Knowledge changes (RFC-KNOWLEDGE-CHANGE-SETS). Edits to drug
 * interactions and critical lab values are drafted, previewed for who they
 * affect, approved by a second person, applied all-or-nothing, rolled back as
 * a new change, and proven with a file an auditor can re-check.
 *
 * `?area=…&op=create|update|delete&target=<id>` opens the editor prefilled —
 * the "Propose change" links on the existing settings screens use it.
 */
import { Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore, useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import {
  type KnowledgeArea,
  type KnowledgeChangeOp,
  type KnowledgeChangeStatus,
  P,
} from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { Button, Modal, Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { knowledgeChangesService } from "@/services/knowledgeChanges.service";
import { ChangeSetDialog } from "./knowledge-changes/change-set-dialog";
import { ChangeSetsTable } from "./knowledge-changes/change-sets-table";
import { Editor, type EditorPrefill } from "./knowledge-changes/editor";
import { AREA_LABEL, STATUS } from "./knowledge-changes/labels";

const AREAS = Object.keys(AREA_LABEL) as KnowledgeArea[];
const OPS: KnowledgeChangeOp[] = ["create", "update", "delete"];

function readPrefill(params: URLSearchParams): EditorPrefill | null {
  const area = params.get("area") as KnowledgeArea | null;
  const op = params.get("op") as KnowledgeChangeOp | null;
  if (!area || !AREAS.includes(area) || !op || !OPS.includes(op)) return null;
  return { area, op, target: params.get("target") };
}

export function KnowledgeChangesPage() {
  useRequirePermission(P.KNOWLEDGE.CHANGE_SETS.LIST);
  const userId = useAuthStore((s) => s.user?.id);
  const canList = useHasPermission(P.KNOWLEDGE.CHANGE_SETS.LIST);
  const canCreate = useHasPermission(P.KNOWLEDGE.CHANGE_SETS.CREATE);
  const manageInteractions = useHasAnyPermission([
    P.PHARMACY.INTERACTIONS.MANAGE,
    P.ADMIN.SETTINGS.GENERAL.MANAGE,
  ]);
  const manageCriticals = useHasAnyPermission([
    P.LAB.CATALOG.MANAGE,
    P.ADMIN.SETTINGS.GENERAL.MANAGE,
  ]);
  const can = {
    canApprove: useHasPermission(P.KNOWLEDGE.CHANGE_SETS.APPROVE),
    canApply: useHasPermission(P.KNOWLEDGE.CHANGE_SETS.APPLY),
    canRollback: useHasPermission(P.KNOWLEDGE.CHANGE_SETS.ROLLBACK),
    canDraft: canCreate && (manageInteractions || manageCriticals),
  };
  const draftAreas = AREAS.filter((a) =>
    a === "drug_interactions" ? manageInteractions : manageCriticals,
  );
  const [params, setParams] = useSearchParams();
  const [prefill] = useState(() => readPrefill(params));
  const [editorOpen, editor] = useDisclosure(prefill !== null && canCreate);
  const [openId, setOpenId] = useState<string | null>(null);
  const [area, setArea] = useState<KnowledgeArea | null>(null);
  const [status, setStatus] = useState<KnowledgeChangeStatus | null>(null);

  const list = useQuery({
    queryKey: ["knowledge-changes", "list", area, status],
    queryFn: () =>
      knowledgeChangesService.list({ area: area ?? undefined, status: status ?? undefined }),
    // No permission, no request (RFC §7).
    enabled: canList,
  });
  const closeEditor = () => {
    editor.close();
    if (params.size > 0) setParams({}, { replace: true });
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Knowledge changes"
        subtitle="Drug interactions and critical lab values: preview who a change affects, approve, apply, roll back"
        actions={
          can.canDraft && draftAreas.length > 0 ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={editor.open}>
              New change
            </Button>
          ) : undefined
        }
      />
      <Group gap="sm" align="flex-end">
        <Select
          label="Area"
          placeholder="All areas"
          clearable
          value={area}
          data={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))}
          onChange={(v) => setArea(v as KnowledgeArea | null)}
        />
        <Select
          label="Status"
          placeholder="Any status"
          clearable
          value={status}
          data={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
          onChange={(v) => setStatus(v as KnowledgeChangeStatus | null)}
        />
      </Group>
      <ChangeSetsTable
        sets={list.data}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        onOpen={setOpenId}
      />
      <ChangeSetDialog
        id={openId}
        userId={userId}
        can={can}
        onClose={() => setOpenId(null)}
        onOpen={setOpenId}
      />
      <Modal opened={editorOpen} onClose={closeEditor} title="New knowledge change" size="xl">
        {editorOpen && (
          <Editor
            areas={draftAreas}
            prefill={prefill}
            onCancel={closeEditor}
            onCreated={(id) => {
              closeEditor();
              setOpenId(id);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
