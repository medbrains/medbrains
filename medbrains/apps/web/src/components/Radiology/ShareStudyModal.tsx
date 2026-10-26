/**
 * Share one study by an expiring link: with a referring doctor, for a second
 * opinion, or with the patient. The link opens only this study, lasts at
 * most a week, can be revoked here, and every open is counted and audited.
 */
import { CopyButton, Group, Stack, Text } from "@mantine/core";
import type { StudyShareLink } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { QueryError } from "@/components/QueryError";
import { Alert, Badge, Button, Input, Modal, SegmentedControl, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

interface ShareStudyModalProps {
  studyId: string;
  onClose: () => void;
}

const EXPIRY = [
  { value: "24", label: "1 day" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
];

function linkState(l: StudyShareLink): { tone: "neutral" | "danger" | "success"; label: string } {
  if (l.revoked_at) return { tone: "neutral", label: "Revoked" };
  if (new Date(l.expires_at) <= new Date()) return { tone: "neutral", label: "Expired" };
  return { tone: "success", label: "Active" };
}

export function ShareStudyModal({ studyId, onClose }: ShareStudyModalProps) {
  const qc = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("72");
  const [made, setMade] = useState<string | null>(null);
  const links = useQuery({
    queryKey: ["radiology-share-links", studyId],
    queryFn: () => radiologyService.listStudyShareLinks(studyId),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["radiology-share-links", studyId] });
  const create = useMutation({
    mutationFn: () =>
      radiologyService.createRadiologyShareLink({
        study_id: studyId,
        recipient_name: recipient.trim(),
        ...(email.trim() ? { recipient_email: email.trim() } : {}),
        expires_hours: Number(hours),
      }),
    onSuccess: (link) => {
      setMade(`${window.location.origin}${link.viewer_url}`);
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
          Anyone with the link can see these images until it expires — send it only to the person
          named. Every open is recorded.
        </Text>
        <Group grow align="flex-start">
          <Input
            label="For"
            required
            placeholder="Dr. Rao, City Hospital"
            value={recipient}
            onChange={(e) => setRecipient(e.currentTarget.value)}
          />
          <Input
            label="Their email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </Group>
        <Group justify="space-between">
          <SegmentedControl
            aria-label="Link lasts"
            data={EXPIRY}
            value={hours}
            onChange={setHours}
          />
          <Button
            tone="primary"
            disabled={recipient.trim() === ""}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Make link
          </Button>
        </Group>
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
              { key: "for", label: "For", render: (l: StudyShareLink) => l.recipient_name ?? "—" },
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
