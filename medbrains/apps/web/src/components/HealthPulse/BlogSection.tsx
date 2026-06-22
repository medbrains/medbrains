import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { BlogPost, UpsertBlogInput } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Drawer,
  IconButton,
  Image,
  Input,
  RichTextEditor,
  Select,
} from "@/components/ui";
import styles from "./blog-section.module.scss";

const AUTHOR_PERM = "admin.settings.branding.manage";

function formatDate(raw: string | null): string {
  if (!raw) return "Draft";
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return "";
  return new Date(time).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FORM: UpsertBlogInput = {
  title: "",
  excerpt: "",
  body_html: "",
  cover_image_url: "",
  status: "draft",
};

/** "Our Blog" — hospital-authored posts in Health Pulse, with an author editor. */
export function BlogSection() {
  const canAuthor = useHasPermission(AUTHOR_PERM);
  const queryClient = useQueryClient();
  const [reading, setReading] = useState<BlogPost | null>(null);
  const [editorOpen, editor] = useDisclosure(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertBlogInput>(EMPTY_FORM);

  const { data: posts } = useQuery({
    queryKey: ["blog", canAuthor],
    queryFn: () => api.listBlog({ include_drafts: canAuthor }),
    staleTime: 120_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["blog"] });
  const save = useMutation({
    mutationFn: (input: UpsertBlogInput) =>
      editId ? api.updateBlogPost(editId, input) : api.createBlogPost(input),
    onSuccess: () => {
      invalidate();
      editor.close();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteBlogPost(id),
    onSuccess: invalidate,
  });

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    editor.open();
  };
  const openEdit = (post: BlogPost) => {
    setEditId(post.id);
    setForm({
      title: post.title,
      excerpt: post.excerpt ?? "",
      body_html: post.body_html,
      cover_image_url: post.cover_image_url ?? "",
      status: post.status,
    });
    editor.open();
  };

  return (
    <Stack gap="md">
      {canAuthor && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<Plus size={15} />} onClick={openNew}>
            New post
          </Button>
        </Group>
      )}

      {!posts?.length ? (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No blog posts yet.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {posts.map((post) => (
            <Card key={post.id} withBorder className={styles.card} onClick={() => setReading(post)}>
              {post.cover_image_url && (
                <Image className={styles.cover} src={post.cover_image_url} alt="" />
              )}
              <Group justify="space-between" gap="xs" mt={post.cover_image_url ? "sm" : 0}>
                <Text className={styles.cardTitle}>{post.title}</Text>
                {post.status !== "published" && <Badge tone="warning">{post.status}</Badge>}
              </Group>
              {post.excerpt && (
                <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                  {post.excerpt}
                </Text>
              )}
              <Group justify="space-between" align="center" mt="sm">
                <Text size="xs" c="dimmed">
                  {post.author_name ?? "Hospital"} · {formatDate(post.published_at)}
                </Text>
                {canAuthor && (
                  <Group gap={4} onClick={(event) => event.stopPropagation()}>
                    <IconButton
                      tone="default"
                      aria-label="Edit post"
                      onClick={() => openEdit(post)}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      aria-label="Delete post"
                      onClick={() => remove.mutate(post.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Group>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Reader */}
      <Drawer
        opened={Boolean(reading)}
        onClose={() => setReading(null)}
        position="right"
        size="lg"
        title="Article"
      >
        {reading && (
          <Stack gap="sm">
            <Text className={styles.readerTitle}>{reading.title}</Text>
            <Text size="xs" c="dimmed">
              {reading.author_name ?? "Hospital"} · {formatDate(reading.published_at)}
            </Text>
            {reading.cover_image_url && (
              <Image className={styles.readerCover} src={reading.cover_image_url} alt="" />
            )}
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: body is sanitized tiptap HTML authored by trusted hospital staff */}
            <div
              className={styles.readerBody}
              dangerouslySetInnerHTML={{ __html: reading.body_html }}
            />
          </Stack>
        )}
      </Drawer>

      {/* Author editor */}
      <Drawer
        opened={editorOpen}
        onClose={editor.close}
        position="right"
        size="xl"
        title={editId ? "Edit post" : "New post"}
      >
        <Stack gap="sm">
          <Input
            label="Title"
            value={form.title}
            onChange={(event) => setForm((f) => ({ ...f, title: event.currentTarget.value }))}
            required
          />
          <Input
            label="Excerpt"
            value={form.excerpt ?? ""}
            onChange={(event) => setForm((f) => ({ ...f, excerpt: event.currentTarget.value }))}
          />
          <Input
            label="Cover image URL"
            value={form.cover_image_url ?? ""}
            onChange={(event) =>
              setForm((f) => ({ ...f, cover_image_url: event.currentTarget.value }))
            }
          />
          <Select
            label="Status"
            value={form.status ?? "draft"}
            onChange={(value) =>
              setForm((f) => ({ ...f, status: (value ?? "draft") as UpsertBlogInput["status"] }))
            }
            data={[
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
              { value: "archived", label: "Archived" },
            ]}
          />
          <RichTextEditor
            ariaLabel="Post body"
            value={form.body_html ?? ""}
            onChange={(html) => setForm((f) => ({ ...f, body_html: html }))}
            minHeight={260}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={editor.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={save.isPending}
              disabled={!form.title.trim()}
              onClick={() => save.mutate(form)}
            >
              {editId ? "Save" : "Publish"}
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
