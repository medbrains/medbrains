/**
 * Share one study by an expiring link: with a referring doctor, for a second
 * opinion, or with the patient. The link opens only this study, and only
 * after its recipient enters a code sent to them; it lasts a day unless set
 * otherwise, can be revoked here, and every open is counted and audited.
 */
import { CopyButton, Group, Stack, Text } from "@mantine/core";
import type { CreateStudyShareLink, StudyShareLink } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { QueryError } from "@/components/QueryError";
import { Alert, Badge, Button, Modal, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";
import { ShareLinkForm } from "./ShareLinkForm";

interface ShareStudyModalProps {
  studyId: string;
  onClose: () => void;
}

function linkState(l: StudyShareLink): { tone: "neutral" | "danger" | "success"; label: string } {
  if (l.revoked_at) return { tone: "neutral", label: "Revoked" };
  if (new Date(l.expires_at) <= new Date()) return { tone: "neutral", label: "Expired" };
  return { tone: "success", label: "Active" };
}

export function ShareStudyModal({ studyId, onClose }: ShareStudyModalProps) {
  const qc = useQueryClient();
  const [made, setMade] = useState<string | null>(null);
  const links = useQuery({
    queryKey: ["radiology-share-links", studyId],
    queryFn: () => radiologyService.listStudyShareLinks(studyId),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["radiology-share-links", studyId] });
  const create = useMutation({
    mutationFn: (request: CreateStudyShareLink) =>
      radiologyService.createRadiologyShareLink(request),
    onSuccess: (link) => {
      setMade(`${window.location.origin}${link.share_url}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Link not made" }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => radiologyService.revokeStudyShareLink(id),
    onSuccess: () => {
      refresh();
      toast.success("The link no longer opens the images.", { title: "Link revoked" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not revoked" }),
  });

  return (
    <Modal opened onClose={onClose} title="Share images" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          The link opens nothing on its own: the recipient enters a code sent to their phone or
          email. Every open is recorded.
        </Text>
        <ShareLinkForm
          studyId={studyId}
          loading={create.isPending}
          onSubmit={(request) => create.mutate(request)}
        />
        {made && (
          <Alert tone="success" title="Link ready">
            <Stack gap="xs">
              <Text size="sm" ff="monospace" style={{ wordBreak: "break-all" }}>
                {made}
              </Text>
              <CopyButton value={made}>
                {({ copied, copy }) => (
                  <Button size="xs" tone="secondary" onClick={copy}>
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                )}
              </CopyButton>
            </Stack>
          </Alert>
        )}
        {links.isError ? (
          <QueryError error={links.error} onRetry={() => void links.refetch()} />
        ) : (
          <DataTable
            loading={links.isLoading}
            data={links.data ?? []}
            rowKey={(l) => l.id}
            emptyTitle="Not shared yet"
            columns={[
              {
                key: "for",
                label: "For",
                render: (l: StudyShareLink) => (
                  <Group gap={4}>
                    <Text size="sm">
                      {l.recipient_kind === "patient" ? "The patient" : (l.recipient_name ?? "—")}
                    </Text>
                    {l.deidentify && (
                      <Badge size="sm" tone="info">
                        De-identified
                      </Badge>
                    )}
                  </Group>
                ),
              },
              {
                key: "state",
                label: "Status",
                render: (l: StudyShareLink) => {
                  const s = linkState(l);
                  return <Badge tone={s.tone}>{s.label}</Badge>;
                },
              },
              {
                key: "until",
                label: "Until",
                render: (l: StudyShareLink) => new Date(l.expires_at).toLocaleString(),
              },
              {
                key: "opened",
                label: "Opened",
                render: (l: StudyShareLink) =>
                  l.accessed_count === 0
                    ? "Not yet"
                    : `${l.accessed_count}× · last ${new Date(l.last_accessed ?? "").toLocaleString()}`,
              },
              {
                key: "revoke",
                label: "",
                render: (l: StudyShareLink) =>
                  linkState(l).label === "Active" ? (
                    <Button
                      size="xs"
                      tone="ghost"
                      loading={revoke.isPending && revoke.variables === l.id}
                      onClick={() => revoke.mutate(l.id)}
                    >
                      Revoke
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Stack>
    </Modal>
  );
}
