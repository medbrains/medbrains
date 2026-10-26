/**
 * Open a study's images, or share them — the same two actions wherever a
 * study is listed (order, chart, DICOM list, OPD investigations).
 *
 * The viewer is MedBrains' own (behind sign-in, through the PACS proxy), so
 * it opens from anywhere, not only on the hospital network, and each open
 * is recorded against the person who opened it.
 */
import { Group } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconPhoto, IconShare } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";
import { ShareStudyModal } from "./ShareStudyModal";

interface StudyImageActionsProps {
  studyId: string;
  size?: "xs" | "sm";
}

export function StudyImageActions({ studyId, size = "sm" }: StudyImageActionsProps) {
  const canView = useHasPermission(P.RADIOLOGY.ORDERS_VIEW);
  const canShare = useHasPermission(P.RADIOLOGY.STUDIES_SHARE);
  const [sharing, setSharing] = useState(false);
  const open = useMutation({
    // The tab is opened inside the click so a popup blocker allows it, then
    // pointed at the viewer once the server has checked and recorded access.
    mutationFn: async (tab: Window | null) => {
      const { viewer_url } = await radiologyService.openStudyViewer(studyId);
      return { tab, viewer_url };
    },
    onSuccess: ({ tab, viewer_url }) => {
      if (tab) {
        tab.opener = null;
        tab.location.href = viewer_url;
      } else {
        window.location.assign(viewer_url);
      }
    },
    onError: (e: Error, tab) => {
      tab?.close();
      toast.error(e.message, { title: "Images not opened" });
    },
  });
  if (!canView) return null;
  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        tone="primary"
        size={size}
        leftSection={<IconPhoto size={16} />}
        loading={open.isPending}
        onClick={() => open.mutate(window.open("", "_blank"))}
      >
        View images
      </Button>
      {canShare && (
        <Button
          tone="secondary"
          size={size}
          leftSection={<IconShare size={16} />}
          onClick={() => setSharing(true)}
        >
          Share
        </Button>
      )}
      {sharing && <ShareStudyModal studyId={studyId} onClose={() => setSharing(false)} />}
    </Group>
  );
}
