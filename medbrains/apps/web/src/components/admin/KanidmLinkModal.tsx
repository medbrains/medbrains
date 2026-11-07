/**
 * Link a MedBrains account to a person in the hospital's own sign-in service (Kanidm), or remove the link.
 * An email address never links an account there, so an existing member of staff who signs in through it is
 * linked here by IT, who picks the person by name and ID. Linking an administrator's account needs an
 * administrator; the server refuses anyone else.
 */

import { Group, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { KanidmPerson } from "@medbrains/types";
import { IconLink, IconLinkOff, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Input, Modal, Table } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";

/** How long typing rests before the directory is asked. */
const SEARCH_DELAY_MS = 300;

export interface KanidmLinkTarget {
  id: string;
  username: string;
  full_name: string;
}

interface KanidmLinkModalProps {
  user: KanidmLinkTarget;
  onClose: () => void;
}

export function KanidmLinkModal({ user, onClose }: KanidmLinkModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const linkKey = ["sso-link", user.id];
  const link = useQuery({ queryKey: linkKey, queryFn: () => api.getUserSsoLink(user.id) });
  const people = useQuery({
    queryKey: ["kanidm-people", query],
    queryFn: () => api.listKanidmPeople(query),
  });
  const done = (title: string) => {
    notifications.show({ title, message: user.full_name, color: "success" });
    void queryClient.invalidateQueries({ queryKey: linkKey });
    void queryClient.invalidateQueries({ queryKey: ["kanidm-people"] });
  };
  const fail = (err: Error) =>
    notifications.show({ title: "The link did not change", message: err.message, color: "danger" });
  const linkTo = useMutation({
    mutationFn: (person: KanidmPerson) => api.linkUserSso(user.id, person.uuid),
    onSuccess: () => done("Linked to the sign-in person"),
    onError: fail,
  });
  const unlink = useMutation({
    mutationFn: () => api.unlinkUserSso(user.id),
    onSuccess: () => done("Link removed"),
    onError: fail,
  });
  const confirmUnlink = () =>
    confirmDestructive({
      title: "Remove the link?",
      message: `${user.full_name} will no longer sign in through the sign-in service. An account with no password of its own cannot sign in at all until it is linked again.`,
      confirmLabel: "Remove link",
      onConfirm: () => unlink.mutate(),
    });

  return (
    <Modal opened onClose={onClose} title={`Link ${user.full_name} to a sign-in person`} size="lg">
      <Stack gap="md">
        <CurrentLink
          subject={link.data?.subject ?? null}
          loading={link.isPending}
          failed={link.isError}
          onUnlink={confirmUnlink}
          unlinking={unlink.isPending}
        />
        <Input
          label="Find a person in the sign-in service"
          description="Search by sign-in name, display name or email."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <PeopleTable
          people={people.data ?? []}
          loading={people.isPending}
          failed={people.isError}
          linkedSubject={link.data?.subject ?? null}
          onLink={(person) => linkTo.mutate(person)}
          linking={linkTo.isPending}
        />
      </Stack>
    </Modal>
  );
}

interface CurrentLinkProps {
  subject: string | null;
  loading: boolean;
  failed: boolean;
  onUnlink: () => void;
  unlinking: boolean;
}

/** The account's link now: to whom, and the way to remove it. A failed read says so, never "not linked". */
function CurrentLink({ subject, loading, failed, onUnlink, unlinking }: CurrentLinkProps) {
  if (failed) {
    return (
      <Alert tone="danger">The account's link could not be read. Close this and try again.</Alert>
    );
  }
  if (loading) {
    return <Text size="sm">Reading the account's link…</Text>;
  }
  if (!subject) {
    return (
      <Alert tone="info">
        Not linked: signing in through the sign-in service makes a new account.
      </Alert>
    );
  }
  return (
    <Group justify="space-between">
      <Text size="sm">
        Linked to sign-in ID{" "}
        <Text span ff="monospace">
          {subject}
        </Text>
      </Text>
      <Button
        tone="danger"
        leftSection={<IconLinkOff size={16} />}
        loading={unlinking}
        onClick={onUnlink}
      >
        Remove link
      </Button>
    </Group>
  );
}

interface PeopleTableProps {
  people: KanidmPerson[];
  loading: boolean;
  failed: boolean;
  linkedSubject: string | null;
  onLink: (person: KanidmPerson) => void;
  linking: boolean;
}

/** The people found, each with its ID and the account it is linked to, if any. */
function PeopleTable({
  people,
  loading,
  failed,
  linkedSubject,
  onLink,
  linking,
}: PeopleTableProps) {
  if (failed) {
    return <Alert tone="danger">The sign-in service did not answer. Try again in a moment.</Alert>;
  }
  if (loading) {
    return <Text size="sm">Searching…</Text>;
  }
  if (people.length === 0) {
    return <Text size="sm">No one in the sign-in service matches.</Text>;
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Person</Table.Th>
          <Table.Th>Sign-in ID</Table.Th>
          <Table.Th>Linked to</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {people.map((person) => (
          <Table.Tr key={person.uuid}>
            <Table.Td>
              <Text size="sm" fw={600}>
                {person.display_name ?? person.name}
              </Text>
              <Text size="xs">
                {person.name}
                {person.mail ? ` · ${person.mail}` : ""}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs" ff="monospace">
                {person.uuid}
              </Text>
            </Table.Td>
            <Table.Td>
              {person.linked_username ? (
                <Badge tone="neutral">{person.linked_username}</Badge>
              ) : (
                "—"
              )}
            </Table.Td>
            <Table.Td>
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconLink size={14} />}
                disabled={person.uuid === linkedSubject || Boolean(person.linked_username)}
                loading={linking}
                onClick={() => onLink(person)}
                aria-label={`Link to ${person.name}`}
              >
                Link
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
