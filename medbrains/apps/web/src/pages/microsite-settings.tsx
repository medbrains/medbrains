import { Group, Stack, Switch, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { micrositeService } from "@/services/microsite.service";

function SeoTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["seo-settings"],
    queryFn: () => micrositeService.listSeoSettings(),
  });
  const save = useMutation({
    mutationFn: () =>
      micrositeService.upsertSeoSetting({
        page_slug: slug,
        meta_title: title || undefined,
        meta_description: desc || undefined,
        keywords: keywords || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seo-settings"] });
      toast.success("SEO saved", { title: "Micro-site" });
      setSlug("");
      setTitle("");
      setDesc("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  return (
    <Stack gap="sm" pt="md">
      {canManage && (
        <>
          <Group grow>
            <TextInput
              label="Page slug"
              value={slug}
              onChange={(e) => setSlug(e.currentTarget.value)}
              placeholder="home"
            />
            <TextInput
              label="Meta title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Meta description"
            value={desc}
            onChange={(e) => setDesc(e.currentTarget.value)}
          />
          <TextInput
            label="Keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.currentTarget.value)}
          />
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!slug.trim()}>
            Save page SEO
          </Button>
        </>
      )}
      {data.map((s) => (
        <Group key={s.id} gap="xs">
          <Badge tone="neutral" size="xs">
            /{s.page_slug}
          </Badge>
          <Text size="sm">{s.meta_title ?? "—"}</Text>
        </Group>
      ))}
    </Stack>
  );
}

function DomainsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["site-domains"],
    queryFn: () => micrositeService.listSiteDomains(),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["site-domains"] });
  };
  const add = useMutation({
    mutationFn: () => micrositeService.addSiteDomain({ domain }),
    onSuccess: () => {
      invalidate();
      toast.success("Domain added", { title: "Micro-site" });
      setDomain("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const verify = useMutation({
    mutationFn: (id: string) => micrositeService.verifySiteDomain(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  return (
    <Stack gap="sm" pt="md">
      {canManage && (
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Custom domain"
            value={domain}
            onChange={(e) => setDomain(e.currentTarget.value)}
            placeholder="hospital.com"
            style={{ flex: 1 }}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!domain.trim()}>
            Add domain
          </Button>
        </Group>
      )}
      {data.map((d) => (
        <Group key={d.id} justify="space-between">
          <Group gap={6}>
            <Text size="sm">{d.domain}</Text>
            {d.is_primary && (
              <Badge tone="info" size="xs">
                primary
              </Badge>
            )}
            <Badge tone={d.is_verified ? "success" : "warning"} size="xs">
              {d.is_verified ? "verified" : "pending"}
            </Badge>
          </Group>
          {canManage && !d.is_verified && (
            <Button size="xs" tone="secondary" onClick={() => verify.mutate(d.id)}>
              Mark verified
            </Button>
          )}
        </Group>
      ))}
    </Stack>
  );
}

function WidgetTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["microsite-config"],
    queryFn: () => micrositeService.getMicrositeConfig(),
  });
  const [waNumber, setWaNumber] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    setWaNumber(data.whatsapp_number ?? "");
    setWaEnabled(data.whatsapp_enabled);
    setChatEnabled(data.chat_widget_enabled);
    setGreeting(data.chat_greeting ?? "");
    setSeeded(true);
  }
  const save = useMutation({
    mutationFn: () =>
      micrositeService.updateMicrositeConfig({
        whatsapp_number: waNumber || undefined,
        whatsapp_enabled: waEnabled,
        chat_widget_enabled: chatEnabled,
        chat_greeting: greeting || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["microsite-config"] });
      toast.success("Widget config saved", { title: "Micro-site" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  return (
    <Stack gap="sm" pt="md">
      <Switch
        label="WhatsApp widget enabled"
        checked={waEnabled}
        onChange={(e) => setWaEnabled(e.currentTarget.checked)}
        disabled={!canManage}
      />
      <TextInput
        label="WhatsApp number"
        value={waNumber}
        onChange={(e) => setWaNumber(e.currentTarget.value)}
        placeholder="+91…"
        disabled={!canManage}
      />
      <Switch
        label="Chat widget enabled"
        checked={chatEnabled}
        onChange={(e) => setChatEnabled(e.currentTarget.checked)}
        disabled={!canManage}
      />
      <TextInput
        label="Chat greeting"
        value={greeting}
        onChange={(e) => setGreeting(e.currentTarget.value)}
        disabled={!canManage}
      />
      {canManage && (
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save widget config
        </Button>
      )}
    </Stack>
  );
}

export function MicrositeSettingsPage() {
  useRequirePermission("specialty.health_packages.list");
  const canManage = useHasPermission("specialty.health_packages.manage");
  return (
    <Stack gap="md">
      <PageHeader
        title="Micro-site settings"
        subtitle="SEO, custom domains & chat widgets for the public site"
        icon={<IconWorld size={20} />}
      />
      <Tabs defaultValue="seo">
        <Tabs.List>
          <Tabs.Tab value="seo">SEO</Tabs.Tab>
          <Tabs.Tab value="domains">Domains</Tabs.Tab>
          <Tabs.Tab value="widgets">Widgets</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="seo">
          <SeoTab canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="domains">
          <DomainsTab canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="widgets">
          <WidgetTab canManage={canManage} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
