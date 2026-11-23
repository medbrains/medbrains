import { Box, Skeleton, Stack, Text } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@/components/ui";
// The printed look is the same sheet of paper the drawing pad is.
import paper from "@/components/ui/signature-pad.module.scss";
import { doctorService } from "@/services/doctor.service";

interface SignaturePrintPreviewProps {
  image: string | null;
  /** An image was asked for (draw or upload) and none is there yet. */
  isAwaitingImage: boolean;
}

/**
 * How the signer's block prints under a record: the image, or the words a
 * record signed with no image carries, over their name, designation and
 * registration number. Those are read from their profile and cannot be
 * edited here: a signature block is not where a registration is changed.
 */
export function SignaturePrintPreview({ image, isAwaitingImage }: SignaturePrintPreviewProps) {
  const fullName = useAuthStore((state) => state.user?.full_name);
  const isDoctor = useHasPermission(P.DOCTOR.PROFILE.VIEW_OWN);
  const profile = useQuery({
    queryKey: ["my-doctor-profile"],
    queryFn: () => doctorService.getMyProfile(),
    enabled: isDoctor,
    retry: 0,
  });
  if (isDoctor && profile.isLoading) return <Skeleton height={120} />;
  const name = profile.data?.display_name ?? fullName ?? "";
  const registration = profile.data?.mci_number ?? profile.data?.state_council_number;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Preview as printed
      </Text>
      {/* The sheet sets its own ink, so the text on it inherits that, not the app's text colour. */}
      <Box className={paper.paper} p="md">
        {image && <Image src={image} alt="Your signature" h={56} w="auto" fit="contain" />}
        {!image && (
          <Text size="sm" c="inherit">
            {isAwaitingImage ? "Your signature will show here." : `Digitally signed by ${name}`}
          </Text>
        )}
        <Text size="sm" fw={600} c="inherit">
          {name}
        </Text>
        {profile.data?.qualification_string && (
          <Text size="xs" c="inherit">
            {profile.data.qualification_string}
          </Text>
        )}
        {/* ponytail: a nurse's licence number is on the nurse profile; shown when nurses ask. */}
        {isDoctor && (
          <Text size="xs" c="inherit">
            {registration
              ? `Reg. no. ${registration}`
              : "Registration number missing. Ask HR to add it."}
          </Text>
        )}
      </Box>
    </Stack>
  );
}
