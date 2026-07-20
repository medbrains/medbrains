import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AuditTab } from "./consent/audit-tab";
import { SignaturesTab } from "./consent/signatures-tab";
import { TemplatesTab } from "./consent/templates-tab";
import { VerificationTab } from "./consent/verification-tab";

export function ConsentPage() {
  useRequirePermission(P.CONSENT.TEMPLATES_LIST);

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
      <Tabs defaultValue="templates">
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
