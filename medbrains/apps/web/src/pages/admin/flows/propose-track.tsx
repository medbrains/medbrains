/**
 * Propose a built track: enabled only when every check passes and the test
 * drive has run on this revision. It becomes a knowledge change set the
 * quality officer and the medical superintendent approve; the server runs
 * every check again on create, preview and apply.
 */
import { Stack, Text } from "@mantine/core";
import { useHasAllPermissions } from "@medbrains/stores";
import type { FlowBuilder, FlowStation, KnowledgeRowFields } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconSend } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, Panel, TextArea, toast } from "@/components/ui";
import { knowledgeChangesService } from "@/services/knowledgeChanges.service";
import { proposeState } from "./builder";
import { builderKey } from "./use-autosave";

export interface ProposeTrackProps {
  view: FlowBuilder;
  track: FlowStation[];
  dirty: boolean;
}

export function ProposeTrack({ view, track, dirty }: ProposeTrackProps) {
  const queryClient = useQueryClient();
  // The change set needs `create` and the area's manage permission.
  const canPropose = useHasAllPermissions([P.KNOWLEDGE.CHANGE_SETS.CREATE, P.FLOWS.SWITCH]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const state = proposeState({ draft: view.draft, checks: view.checks, unsaved: dirty });
  const propose = useMutation({
    mutationFn: async () => {
      const draft = view.draft;
      if (!draft) throw new Error("There is no draft to propose");
      const after: KnowledgeRowFields = {
        flow_code: view.code,
        ...view.switches,
        track: draft.stations,
        draft_id: draft.id,
        draft_revision: draft.revision,
      };
      const set = await knowledgeChangesService.create({
        area: "flow_switches",
        title: `${view.name}: new track (draft revision ${draft.revision}, ${track.length} stations)`,
        reason: reason.trim(),
        items: [{ op: "update", target_id: view.template_id, after }],
      });
      return knowledgeChangesService.preview(set.id);
    },
    onSuccess: () => {
      toast.success(
        "It changes nothing until the quality officer and the medical superintendent approve it and it is applied.",
        { title: "Track proposed" },
      );
      setOpen(false);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["flows", view.code] });
      void queryClient.invalidateQueries({ queryKey: builderKey(view.code) });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not propose the track" }),
  });

  return (
    <Panel title="Propose">
      <Stack gap="xs">
        <Text size="sm">
          {state.ok
            ? "Every check passes and the test drive has run. Propose it for approval."
            : `Not ready to propose: ${state.reason}`}
        </Text>
        {!canPropose && (
          <Text size="xs" c="dimmed">
            Proposing needs permission to propose flow changes; ask a quality officer.
          </Text>
        )}
        <Button
          tone="primary"
          leftSection={<IconSend size={16} />}
          disabled={!state.ok || !canPropose}
          onClick={() => setOpen(true)}
        >
          Propose this track
        </Button>
      </Stack>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Propose this track"
        primaryAction={{
          label: "Propose",
          onClick: () => propose.mutate(),
          loading: propose.isPending,
          disabled: reason.trim().length === 0,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Text size="sm">
            Patients already in discharge finish on the version they started. New discharges follow
            this track once it is approved and applied.
          </Text>
          <TextArea
            label="Why (the SOP or decision this follows)"
            required
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            data-autofocus
          />
        </Stack>
      </Modal>
    </Panel>
  );
}
