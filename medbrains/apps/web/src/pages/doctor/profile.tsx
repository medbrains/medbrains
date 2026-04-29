/**
 * Self-service doctor profile page — edit bio, photo, languages.
 * Capability flags (can_sign_mlc etc.) are admin-only, shown read-only.
 */
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconUserCog } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function DoctorProfilePage() {
  useRequirePermission(P.DOCTOR.PROFILE.VIEW_OWN);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-doctor-profile"],
    queryFn: () => api.getMyDoctorProfile(),
    retry: 0,
  });

  const [bioShort, setBioShort] = useState("");
  const [bioLong, setBioLong] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [languages, setLanguages] = useState("");

  useEffect(() => {
    if (profile) {
      setBioShort(profile.bio_short ?? "");
      setBioLong(profile.bio_long ?? "");
      setPhotoUrl(profile.photo_url ?? "");
      setLanguages((profile.languages_spoken ?? []).join(", "));
    }
  }, [profile]);

  const update = useMutation({
    mutationFn: () =>
      api.updateMyDoctorProfile({
        bio_short: bioShort || null,
        bio_long: bioLong || null,
        photo_url: photoUrl || null,
        languages_spoken: languages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      notifications.show({
        title: "Profile updated",
        message: "Your profile has been saved.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["my-doctor-profile"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  if (isLoading)
    return <Text size="sm" c="dimmed">Loading…</Text>;
  if (!profile)
    return (
      <Text size="sm" c="dimmed">
        No doctor profile found for your user. Ask an administrator to create one.
      </Text>
    );

  return (
    <div>
      <PageHeader
        title="My profile"
        subtitle={profile.qualification_string ?? undefined}
        icon={<IconUserCog size={20} stroke={1.5} />}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card padding="md" withBorder>
            <Stack gap="sm" align="center">
              <Avatar src={profile.photo_url} size={120} radius="xl" />
              <Text fw={700} size="lg">
                {profile.prefix ? `${profile.prefix} ` : ""}{profile.display_name}
              </Text>
              <Text size="sm" c="dimmed">
                {profile.qualification_string}
              </Text>
              <Group gap="xs">
                {profile.is_visiting && (
                  <Badge size="sm" color="warning">Visiting</Badge>
                )}
                {profile.is_full_time && (
                  <Badge size="sm" color="primary">Full-time</Badge>
                )}
                {!profile.is_active && (
                  <Badge size="sm" color="red">Inactive</Badge>
                )}
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card padding="md" withBorder>
            <Text fw={600} size="sm" mb="sm">Editable</Text>
            <Stack gap="sm">
              <TextInput
                label="Photo URL"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.currentTarget.value)}
              />
              <TextInput
                label="Languages spoken (comma-separated)"
                value={languages}
                onChange={(e) => setLanguages(e.currentTarget.value)}
                placeholder="English, Hindi, Tamil"
              />
              <Textarea
                label="Short bio"
                value={bioShort}
                onChange={(e) => setBioShort(e.currentTarget.value)}
                autosize
                minRows={2}
                maxRows={4}
              />
              <Textarea
                label="Long bio"
                value={bioLong}
                onChange={(e) => setBioLong(e.currentTarget.value)}
                autosize
                minRows={4}
                maxRows={10}
              />
              <Group justify="flex-end">
                <Button
                  loading={update.isPending}
                  onClick={() => update.mutate()}
                >
                  Save changes
                </Button>
              </Group>
            </Stack>
          </Card>

          <Card padding="md" withBorder mt="md">
            <Text fw={600} size="sm" mb="sm">
              Credentials & capabilities (admin-managed)
            </Text>
            <Divider mb="sm" />
            <Stack gap={4}>
              <ReadOnly label="MCI / state council">
                {profile.mci_number ?? profile.state_council_number ?? "—"}
              </ReadOnly>
              <ReadOnly label="Specialties">
                {profile.specialty_ids.length === 0
                  ? "—"
                  : `${profile.specialty_ids.length} assigned`}
              </ReadOnly>
              <ReadOnly label="Years experience">
                {profile.years_experience ?? "—"}
              </ReadOnly>
              <ReadOnly label="Schedule X prescribing">
                <Badge size="xs" color={profile.can_prescribe_schedule_x ? "primary" : "gray"}>
                  {profile.can_prescribe_schedule_x ? "Yes" : "No"}
                </Badge>
              </ReadOnly>
              <ReadOnly label="Can sign MLC">
                <Badge size="xs" color={profile.can_sign_mlc ? "primary" : "gray"}>
                  {profile.can_sign_mlc ? "Yes" : "No"}
                </Badge>
              </ReadOnly>
              <ReadOnly label="Can sign death certificate">
                <Badge size="xs" color={profile.can_sign_death_certificate ? "primary" : "gray"}>
                  {profile.can_sign_death_certificate ? "Yes" : "No"}
                </Badge>
              </ReadOnly>
              <ReadOnly label="Can perform surgery">
                <Badge size="xs" color={profile.can_perform_surgery ? "primary" : "gray"}>
                  {profile.can_perform_surgery ? "Yes" : "No"}
                </Badge>
              </ReadOnly>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}

function ReadOnly({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={500}>{children}</Text>
    </Group>
  );
}
