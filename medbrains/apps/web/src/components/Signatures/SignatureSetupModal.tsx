import { Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui";
import { OWN_SIGNATURE_KEY } from "@/hooks/useOwnSignature";
import { signoffService } from "@/services/signoff.service";
import { SignatureSetupForm } from "./SignatureSetupForm";

interface SignatureSetupModalProps {
  opened: boolean;
  /**
   * Later, Esc or the close button, where nothing is saved and nothing is
   * lost; and after a save, once the own-signature check is fresh.
   */
  onClose: () => void;
}

/** What a failed save says to the signer. */
function problemOf(error: Error | null): string | null {
  if (!error) return null;
  return error.message === "step_up_required"
    ? "Your password was not confirmed, so nothing was saved."
    : error.message;
}

/**
 * The signer sets up their own signature, where they were asked for it: at
 * the Sign click on a record, or from their profile. Nobody does this for
 * them. Saving asks for the password again (the app's step-up prompt), and
 * closing leaves the record they came from saved and unsigned.
 */
export function SignatureSetupModal({ opened, onClose }: SignatureSetupModalProps) {
  const isNarrow = useMediaQuery("(max-width: 48em)");
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (image: string | null) => signoffService.setMySignature({ image }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: OWN_SIGNATURE_KEY });
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      fullScreen={isNarrow}
      // The password prompt sits on top while saving; its Esc must not close this too.
      closeOnEscape={!save.isPending}
      title={
        <Text fw={600} tabIndex={-1} data-autofocus>
          Set up your signature
        </Text>
      }
    >
      <SignatureSetupForm
        isSaving={save.isPending}
        problem={problemOf(save.error)}
        onSave={(image) => save.mutate(image)}
        onLater={onClose}
      />
    </Modal>
  );
}
