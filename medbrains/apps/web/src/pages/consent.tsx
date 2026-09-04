import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AuditTab } from "./consent/audit-tab";
import { SignaturesTab } from "./consent/signatures-tab";
import { TemplatesTab } from "./consent/templates-tab";
import { VerificationTab } from "./consent/verification-tab";

export function ConsentPage() {
  useRequirePermission(P.CONSENT.TEMPLATES_LIST);
  // The tab is addressable so a link can land on it. Without this a route
  // carrying ?tab=verification opened Templates, which is how "go and check
  // this patient's consent" became "go and find it yourself".
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "templates";

  const canCreateTemplate = useHasPermission(P.CONSENT.TEMPLATES_CREATE);
  const canUpdateTemplate = useHasPermission(P.CONSENT.TEMPLATES_UPDATE);
  const canDeleteTemplate = useHasPermission(P.CONSENT.TEMPLATES_DELETE);
  const canViewAudit = useHasPermission(P.CONSENT.AUDIT_LIST);
  const canVerify = useHasPermission(P.CONSENT.VERIFY);
  const canRevoke = useHasPermission(P.CONSENT.REVOKE);
  const canViewSignatures = useHasPermission(P.CONSENT.SIGNATURES_LIST);
  const canManageSignatures = useHasPermission(P.CONSENT.SIGNATURES_MANAGE);

  return (
    <div>
      <PageHeader
        title="Consent Management"
        subtitle="Consent templates, audit trail, verification, and digital signatures"
      />
      <Tabs
        value={activeTab}
        onChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value) {
            next.set("tab", value);
          } else {
            next.delete("tab");
          }
          setSearchParams(next, { replace: true });
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          {canViewAudit && <Tabs.Tab value="audit">Audit Trail</Tabs.Tab>}
          {canVerify && <Tabs.Tab value="verification">Verification</Tabs.Tab>}
          {canViewSignatures && <Tabs.Tab value="signatures">Signatures</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab
            canCreate={canCreateTemplate}
            canUpdate={canUpdateTemplate}
            canDelete={canDeleteTemplate}
          />
        </Tabs.Panel>
        <Tabs.Panel value="audit" pt="md">
          <AuditTab />
        </Tabs.Panel>
        <Tabs.Panel value="verification" pt="md">
          <VerificationTab canRevoke={canRevoke} />
        </Tabs.Panel>
        <Tabs.Panel value="signatures" pt="md">
          <SignaturesTab canManage={canManageSignatures} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Templates
// ══════════════════════════════════════════════════════════
