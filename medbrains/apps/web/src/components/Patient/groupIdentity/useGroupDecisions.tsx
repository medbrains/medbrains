import type { GroupCandidate } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/components/ui";
import { groupIdentityService } from "@/services/groupIdentity.service";
import { ReasonModal } from "./ReasonModal";

/** Link or reject a probable match; a rejection asks why first. */
export function useGroupDecisions() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<GroupCandidate | null>(null);
  const decide = useMutation({
    mutationFn: ({ c, link, reason }: { c: GroupCandidate; link: boolean; reason?: string }) =>
      groupIdentityService.decide(c.candidate_id, { decision: link ? "link" : "reject", reason }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["group-identity"] });
      setRejecting(null);
      toast.success(
        row.status === "linked"
          ? `Linked to the record at ${row.hospital}.`
          : "Kept apart. The match will not be offered again.",
      );
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record the decision" }),
  });
  const onDecide = (c: GroupCandidate, decision: "link" | "reject") =>
    decision === "link" ? decide.mutate({ c, link: true }) : setRejecting(c);
  const modal = (
    <ReasonModal
      opened={rejecting !== null}
      title="Not the same person"
      explanation={`The record at ${rejecting?.hospital ?? "the other hospital"} stays separate.`}
      confirmLabel="Keep apart"
      busy={decide.isPending}
      onConfirm={(reason) => rejecting && decide.mutate({ c: rejecting, link: false, reason })}
      onClose={() => setRejecting(null)}
    />
  );
  const busyId = decide.isPending ? decide.variables?.c.candidate_id : null;
  return { onDecide, modal, busyId };
}
