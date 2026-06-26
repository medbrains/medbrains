import { Anchor, Card, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { Brand } from "@/components/Brand";
import { Alert } from "@/components/ui";
import { useTenantBrand } from "@/hooks/useTenantBrand";

interface Section {
  heading: string;
  body: string[];
}

function termsSections(org: string): Section[] {
  return [
    {
      heading: "1. Acceptance",
      body: [
        `By accessing ${org} ("the System"), you agree to these Terms of Use. If you do not agree, do not use the System. Access is for authorized staff and partners only.`,
      ],
    },
    {
      heading: "2. Authorized use & accounts",
      body: [
        "Your account is personal — do not share credentials. You are responsible for activity under your account and must protect your password and any second factor.",
        "Access is granted on a least-privilege basis tied to your role; do not attempt to access data or functions outside your authorization.",
      ],
    },
    {
      heading: "3. Acceptable use",
      body: [
        "Use the System only for legitimate clinical, administrative, and operational purposes. Do not copy, export, photograph, transmit, or disclose patient data except as required for care and permitted by your role and applicable law.",
        "Do not introduce malware, attempt to bypass security or audit controls, or use the System to harass, defraud, or violate any law or professional duty.",
      ],
    },
    {
      heading: "4. Patient data & privacy",
      body: [
        "Patient information is sensitive personal data. Handle it per the Privacy Policy, your professional obligations, and applicable law (incl. India's DPDP Act 2023). All access is logged and audited.",
      ],
    },
    {
      heading: "5. Intellectual property & licensing",
      body: [
        "The MedBrains platform is provided under its applicable open-source (AGPL) or commercial licence; hospital content and patient data remain the property of the hospital and the respective data principals.",
      ],
    },
    {
      heading: "6. Disclaimers & clinical responsibility",
      body: [
        "The System is a tool to support — not replace — clinical judgment. Verify critical information before acting. The System is provided 'as is' without warranties to the maximum extent permitted by law.",
      ],
    },
    {
      heading: "7. Limitation of liability",
      body: [
        "To the extent permitted by law, neither the hospital nor the platform provider is liable for indirect or consequential loss arising from use of the System. Nothing limits liability that cannot be limited by law.",
      ],
    },
    {
      heading: "8. Changes, governing law & contact",
      body: [
        "These terms may be updated; continued use means acceptance. They are governed by the laws of the hospital's jurisdiction. Questions: contact your administrator or the hospital's IT/compliance office.",
      ],
    },
  ];
}

function privacySections(org: string): Section[] {
  return [
    {
      heading: "1. Scope",
      body: [
        `This policy explains how ${org} processes personal and health data of patients, staff, and other individuals, consistent with India's Digital Personal Data Protection Act 2023 (DPDP) and applicable health-data regulations.`,
      ],
    },
    {
      heading: "2. What we collect",
      body: [
        "Identifiers (name, UHID, contact, government IDs where required), demographic data, and health data (diagnoses, medications, lab/imaging results, clinical notes), plus operational data (appointments, billing) and access/audit logs.",
      ],
    },
    {
      heading: "3. Purpose & lawful basis",
      body: [
        "Data is processed to provide and document care, run hospital operations (scheduling, pharmacy, billing), meet legal/accreditation obligations, and ensure safety and security. Processing relies on consent and the legitimate, lawful bases permitted for healthcare.",
      ],
    },
    {
      heading: "4. Sharing & processors",
      body: [
        "Data is shared only as needed for care and operations — treating clinicians, authorized staff, and necessary processors (e.g. labs, payment, communications) under contract — or where required by law. It is not sold.",
      ],
    },
    {
      heading: "5. Retention",
      body: [
        "Records are retained for the periods required by medical-records regulations and accreditation, then securely disposed of. Audit logs are retained per policy.",
      ],
    },
    {
      heading: "6. Security",
      body: [
        "We apply role-based access, encryption of secrets, audit logging, and other safeguards. Access is least-privilege and monitored.",
      ],
    },
    {
      heading: "7. Your rights (DPDP)",
      body: [
        "Subject to law, you may request access to and correction of your data, withdraw consent, and seek erasure where applicable. Patients/data principals may raise grievances with the hospital's Grievance Officer.",
      ],
    },
    {
      heading: "8. Grievances, changes & contact",
      body: [
        "Contact the hospital's Data Protection / Grievance Officer for any privacy request or complaint. This policy may be updated; material changes will be communicated.",
      ],
    },
  ];
}

function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const tenant = useTenantBrand();
  const org = tenant?.name || "MedBrains";
  const title = kind === "terms" ? "Terms of Use" : "Privacy Policy";
  const sections = kind === "terms" ? termsSections(org) : privacySections(org);

  return (
    <Stack maw={820} mx="auto" px="md" py="xl">
      <Brand surface="signin" />
      <Title order={1} ta="center">
        {title}
      </Title>
      <Text size="sm" c="var(--mb-text-secondary)" ta="center">
        {org}
      </Text>

      <Alert tone="warning" title="Template — finalize with legal counsel">
        This is a starting template provided with the platform. The hospital is responsible for
        reviewing and publishing its own legally-binding {title.toLowerCase()} for its jurisdiction.
      </Alert>

      <Card withBorder padding="lg">
        <Stack gap="lg">
          {sections.map((s) => (
            <Stack key={s.heading} gap="xs">
              <Title order={2} size="h4">
                {s.heading}
              </Title>
              {s.body.map((p) => (
                <Text key={p} size="sm">
                  {p}
                </Text>
              ))}
            </Stack>
          ))}
        </Stack>
      </Card>

      <Text size="sm" ta="center">
        <Anchor component={Link} to="/login">
          ← Back to sign in
        </Anchor>
        {" · "}
        <Anchor component={Link} to={kind === "terms" ? "/privacy" : "/terms"}>
          {kind === "terms" ? "Privacy Policy" : "Terms of Use"}
        </Anchor>
      </Text>
    </Stack>
  );
}

export function TermsPage() {
  return <LegalPage kind="terms" />;
}

export function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
