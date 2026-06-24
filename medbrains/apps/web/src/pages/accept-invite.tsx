import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Center, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { Alert, Badge, Button, Input, PasswordField } from "@/components/ui";
import { toast } from "@/components/ui/toast";

const schema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z][a-z0-9_]*$/, "Lowercase letters, numbers and _ only"),
  full_name: z.string().min(2, "Your name is required"),
  password: z.string().min(8, "At least 8 characters"),
});
type FormInput = z.infer<typeof schema>;

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const {
    data: invite,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["public-invite", token],
    queryFn: () => api.getPublicInvite(token),
    enabled: token.length > 0,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    values: { username: "", full_name: invite?.full_name ?? "", password: "" },
  });

  const accept = useMutation({
    mutationFn: (data: FormInput) => api.acceptInvite(token, data),
    onSuccess: () => {
      toast.success("Account created — you can sign in now.", { title: "Welcome" });
      navigate("/login");
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not accept invitation" }),
  });

  return (
    <Center mih="100vh" p="md">
      <Card withBorder padding="xl" maw={440} w="100%">
        {isLoading ? (
          <Stack align="center">
            <Loader />
            <Text c="dimmed">Loading invitation…</Text>
          </Stack>
        ) : isError || !invite ? (
          <Alert tone="danger" title="Invitation unavailable">
            {error instanceof Error ? error.message : "This invitation is invalid or has expired."}
          </Alert>
        ) : (
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={3}>Join {invite.hospital_name}</Title>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {invite.email}
                </Text>
                <Badge tone="primary" size="sm">
                  {invite.role}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Set up your account to get started.
              </Text>
            </Stack>

            <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
            <Input
              label="Username"
              placeholder="jane_doe"
              error={errors.username?.message}
              {...register("username")}
            />
            <PasswordField
              label="Password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button
              tone="primary"
              fullWidth
              loading={accept.isPending}
              onClick={() => void handleSubmit((data) => accept.mutate(data))()}
            >
              Create account
            </Button>
          </Stack>
        )}
      </Card>
    </Center>
  );
}
