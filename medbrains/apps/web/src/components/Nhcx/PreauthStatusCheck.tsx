import { Group } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@/components/ui";

interface PreauthStatusCheckProps {
  priorAuthId: string;
}

/** Ask the payer, through NHCX, where a pre-authorisation stands. */
export function PreauthStatusCheck({ priorAuthId }: PreauthStatusCheckProps) {
  const queryClient = useQueryClient();
  const check = useMutation({
    mutationFn: () => api.checkPreauthNhcxStatus(priorAuthId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preauth-nhcx", priorAuthId] });
      toast.success("The payer's answer will update this pre-auth.", {
        title: "Status check sent",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Status check not sent" }),
  });
  return (
    <Group justify="flex-end">
      <Button
        size="xs"
        tone="tertiary"
        leftSection={<IconRefresh size={16} />}
        loading={check.isPending}
        onClick={() => check.mutate()}
      >
        Check status with the payer
      </Button>
    </Group>
  );
}
