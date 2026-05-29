/**
 * Self-service doctor profile page — edit bio, photo, languages.
 * Capability flags (can_sign_mlc etc.) are admin-only, shown read-only.
 */
import { zodResolver } from "@hookform/resolvers/zod";
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
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { DoctorProfile } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconUserCog } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/PageHeader";
import {
  DEFAULT_DOCTOR_PROFILE_FORM_VALUES,
  type DoctorProfileFormInput,
  doctorProfileFormSchema,
  toDoctorProfileFormValues,
  toUpdateMyDoctorProfileRequest,
} from "@/forms/doctor-profile.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { doctorService } from "@/services/doctor.service";

export function DoctorProfilePage() {
  useRequirePermission(P.DOCTOR.PROFILE.VIEW_OWN);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<DoctorProfile>({
    queryKey: ["my-doctor-profile"],
    queryFn: () => doctorService.getMyProfile(),
    retry: 0,
  });

  const profileForm = useForm<DoctorProfileFormInput>({
    resolver: zodResolver(doctorProfileFormSchema),
    defaultValues: DEFAULT_DOCTOR_PROFILE_FORM_VALUES,
    values: toDoctorProfileFormValues(profile),
  });

  const update = useMutation({
    mutationFn: (values: DoctorProfileFormInput) =>
      doctorService.updateMyProfile(toUpdateMyDoctorProfileRequest(values)),
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
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    );
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
                {profile.prefix ? `${profile.prefix} ` : ""}
                {profile.display_name}
              </Text>
              <Text size="sm" c="dimmed">
                {profile.qualification_string}
              </Text>
              <Group gap="xs">
                {profile.is_visiting && (
                  <Badge size="sm" color="warning">
                    Visiting
                  </Badge>
                )}
                {profile.is_full_time && (
                  <Badge size="sm" color="primary">
                    Full-time
                  </Badge>
                )}
                {!profile.is_active && (
                  <Badge size="sm" color="red">
                    Inactive
                  </Badge>
                )}
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card padding="md" withBorder>
            <Text fw={600} size="sm" mb="sm">
              Editable
            </Text>
            <Stack
              component="form"
              gap="sm"
              onSubmit={profileForm.handleSubmit((values) => update.mutate(values))}
            >
              <TextInput
                label="Photo URL"
                error={profileForm.formState.errors.photo_url?.message}
                {...profileForm.register("photo_url")}
              />
              <TextInput
                label="Languages spoken (comma-separated)"
                placeholder="English, Hindi, Tamil"
                error={profileForm.formState.errors.languages_spoken?.message}
                {...profileForm.register("languages_spoken")}
              />
              <Textarea
                label="Short bio"
                autosize
                minRows={2}
                maxRows={4}
                error={profileForm.formState.errors.bio_short?.message}
                {...profileForm.register("bio_short")}
              />
              <Textarea
                label="Long bio"
                autosize
                minRows={4}
                maxRows={10}
                error={profileForm.formState.errors.bio_long?.message}
                {...profileForm.register("bio_long")}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={update.isPending}>
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
              <ReadOnly label="Years experience">{profile.years_experience ?? "—"}</ReadOnly>
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
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {children}
      </Text>
    </Group>
  );
}
