import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore } from "@medbrains/stores";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  IconBed,
  IconBrandGithub,
  IconBrandOpenSource,
  IconCertificate,
  IconCheck,
  IconFlask,
  IconHeartRateMonitor,
  IconList,
  IconPill,
  IconReceipt,
  IconSearch,
  IconServer,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react";
import classes from "./landing.module.scss";

interface FeatureEntry {
  category: string;
  module: string;
  subModule: string;
  feature: string;
  priority: string;
  status: string;
  web: string;
  mobile: string;
  tv: string;
}

const coreFeatures = [
  {
    icon: IconUsers,
    title: "Patient Management",
    desc: "Complete patient registration, UHID generation, demographics, and document management.",
  },
  {
    icon: IconStethoscope,
    title: "OPD / Outpatient",
    desc: "Token queue, doctor assignments, visit tracking, and real-time consultation workflow.",
  },
  {
    icon: IconBed,
    title: "IPD / Inpatient",
    desc: "Bed management, admission-discharge-transfer, ward tracking, and nursing workflows.",
  },
  {
    icon: IconFlask,
    title: "Laboratory / LIS",
    desc: "Sample collection, test ordering, result entry with reference ranges, and reporting.",
  },
  {
    icon: IconPill,
    title: "Pharmacy",
    desc: "Drug inventory, prescription dispensing, stock management, and expiry tracking.",
  },
  {
    icon: IconReceipt,
    title: "Billing & Finance",
    desc: "Invoice generation, insurance claims, payment tracking, and financial reporting.",
  },
];

const moduleCategories = [
  {
    category: "Clinical",
    modules: ["Patient Registration", "OPD", "Emergency", "OT Management", "Nursing"],
  },
  {
    category: "Diagnostics",
    modules: ["Laboratory / LIS", "Radiology / RIS", "Pathology", "Blood Bank"],
  },
  {
    category: "Inpatient",
    modules: ["IPD / Admissions", "Bed Management", "Diet & Nutrition", "Discharge Summary"],
  },
  {
    category: "Finance",
    modules: ["Billing", "Insurance / TPA", "Pharmacy POS", "Accounts Payable"],
  },
  {
    category: "Administration",
    modules: ["User Management", "Role-Based Access", "Audit Trails", "Multi-Tenant Config"],
  },
  {
    category: "Specialty",
    modules: ["Psychiatry", "Medical College", "Telemedicine", "Patient Experience"],
  },
];

const stats = [
  { value: "2,189", label: "Features" },
  { value: "67+", label: "Modules" },
  { value: "NABH", label: "JCI Ready" },
  { value: "100%", label: "Open Source" },
];

function PlatformBadge({ web, mobile, tv }: { web: string; mobile: string; tv: string }) {
  return (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      {web === "Y" && (
        <Badge size="xs" variant="dot" color="primary">W</Badge>
      )}
      {mobile === "Y" && (
        <Badge size="xs" variant="dot" color="teal">M</Badge>
      )}
      {tv === "Y" && (
        <Badge size="xs" variant="dot" color="slate">TV</Badge>
      )}
    </Group>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [allFeatures, setAllFeatures] = useState<FeatureEntry[]>([]);

  // Lazy-load features JSON only when modal opens
  useEffect(() => {
    if (modalOpened && allFeatures.length === 0) {
      import("../data/features.json").then((mod) => {
        setAllFeatures(mod.default as FeatureEntry[]);
      });
    }
  }, [modalOpened, allFeatures.length]);

  // Group features by category → module → subModule
  const groupedFeatures = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? allFeatures.filter(
          (f) =>
            f.feature.toLowerCase().includes(q) ||
            f.module.toLowerCase().includes(q) ||
            f.subModule.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q),
        )
      : allFeatures;

    const byCat: Record<string, Record<string, FeatureEntry[]>> = {};
    for (const f of filtered) {
      const cat = f.category;
      const mod = f.module || "General";
      if (!byCat[cat]) byCat[cat] = {};
      if (!byCat[cat][mod]) byCat[cat][mod] = [];
      byCat[cat][mod].push(f);
    }
    return byCat;
  }, [search, allFeatures]);

  const filteredCount = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allFeatures.length;
    return allFeatures.filter(
      (f) =>
        f.feature.toLowerCase().includes(q) ||
        f.module.toLowerCase().includes(q) ||
        f.subModule.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    ).length;
  }, [search, allFeatures]);

  return (
    <div className={classes.page}>
      {/* Features Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={
          <Group gap="sm">
            <IconList size={20} />
            <Text fw={700} size="lg">All Features</Text>
            <Badge size="sm" variant="light" color="primary">
              {filteredCount.toLocaleString()}
            </Badge>
          </Group>
        }
        size="xl"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
        styles={{ body: { maxHeight: "70vh" } }}
      >
        <TextInput
          placeholder="Search features, modules, categories..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="md"
          size="sm"
        />

        {Object.keys(groupedFeatures).length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            No features found matching &ldquo;{search}&rdquo;
          </Text>
        ) : (
          <Accordion variant="separated" radius="sm">
            {Object.entries(groupedFeatures).map(([category, modules]) => {
              const catCount = Object.values(modules).reduce((sum, arr) => sum + arr.length, 0);
              return (
                <Accordion.Item key={category} value={category}>
                  <Accordion.Control>
                    <Group justify="space-between" pr="sm">
                      <Text fw={600} size="sm">{category}</Text>
                      <Badge size="sm" variant="light" color="primary">
                        {catCount}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Accordion variant="contained" radius="sm">
                      {Object.entries(modules).map(([mod, feats]) => (
                        <Accordion.Item key={mod} value={`${category}-${mod}`}>
                          <Accordion.Control>
                            <Group justify="space-between" pr="sm">
                              <Text size="sm" fw={500}>{mod}</Text>
                              <Badge size="xs" variant="light" color="slate">
                                {feats.length}
                              </Badge>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <div className={classes.featureListModal}>
                              {feats.map((feat, i) => (
                                <div key={i} className={classes.featureListItem}>
                                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                                    <Group gap="sm" wrap="nowrap" align="flex-start" style={{ flex: 1 }}>
                                      <IconCheck size={14} color="var(--mantine-color-primary-5)" style={{ marginTop: 3, flexShrink: 0 }} />
                                      <div>
                                        <Text size="sm" lh={1.4}>{feat.feature}</Text>
                                        {feat.subModule && (
                                          <Text size="xs" c="dimmed" mt={2}>{feat.subModule}</Text>
                                        )}
                                      </div>
                                    </Group>
                                    <PlatformBadge web={feat.web} mobile={feat.mobile} tv={feat.tv} />
                                  </Group>
                                </div>
                              ))}
                            </div>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        )}
      </Modal>

      {/* Navbar */}
      <nav className={classes.navbar}>
        <div className={classes.navbarInner}>
          <div className={classes.navLogo}>
            <img src="/logo/medbrains-mark.svg" alt="" width={32} height={32} style={{ borderRadius: 6 }} />
            <span className={classes.navLogoText}>MedBrains</span>
          </div>

          <div className={classes.navLinks}>
            <a href="#features" className={classes.navLink}>Features</a>
            <a href="#modules" className={classes.navLink}>Modules</a>
            <a href="#open-source" className={classes.navLink}>Open Source</a>
          </div>

          <div className={classes.navActions}>
            {user ? (
              <Button size="sm" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/onboarding")}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={classes.hero}>
        <div className={classes.heroInner}>
          <div className={classes.heroBadge}>
            <IconBrandOpenSource size={16} />
            Open Source HMS
          </div>
          <h1 className={classes.heroTitle}>
            The Hospital Management System Built for <em>Everyone</em>
          </h1>
          <p className={classes.heroSubtitle}>
            2,189 features across 67+ modules. Zero license fees. From OPD to IPD,
            Lab to Pharmacy — everything a modern hospital needs.
          </p>
          <div className={classes.heroCtas}>
            <Button
              size="lg"
              onClick={() => navigate(user ? "/dashboard" : "/onboarding")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              leftSection={<IconList size={18} />}
              onClick={openModal}
            >
              View All Features
            </Button>
            <Button
              size="lg"
              variant="subtle"
              leftSection={<IconBrandGithub size={18} />}
              component="a"
              href="https://github.com/nicholasraman/medbrains"
              target="_blank"
              rel="noopener noreferrer"
            >
              Star on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={classes.stats}>
        <div className={classes.statsInner}>
          {stats.map((stat) => (
            <div key={stat.label} className={classes.statItem}>
              <div className={classes.statValue}>{stat.value}</div>
              <div className={classes.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={classes.features}>
        <div className={classes.sectionInner}>
          <div className={classes.sectionTitle}>Core Modules</div>
          <div className={classes.sectionSubtitle}>
            Everything you need to run a modern hospital, out of the box.
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {coreFeatures.map((f) => (
              <Card key={f.title} className={classes.featureCard} shadow="none">
                <ThemeIcon variant="light" size={44} radius="sm" color="primary">
                  <f.icon size={22} stroke={1.5} />
                </ThemeIcon>
                <div className={classes.featureTitle}>{f.title}</div>
                <div className={classes.featureDesc}>{f.desc}</div>
              </Card>
            ))}
          </SimpleGrid>
          <Group justify="center" mt="xl">
            <Button
              variant="light"
              size="md"
              leftSection={<IconSearch size={16} />}
              onClick={openModal}
            >
              Search all 2,189 features
            </Button>
          </Group>
        </div>
      </section>

      {/* All Modules */}
      <section id="modules" className={classes.modules}>
        <div className={classes.sectionInner}>
          <div className={classes.sectionTitle}>Comprehensive Module Coverage</div>
          <div className={classes.sectionSubtitle}>
            From clinical workflows to administrative operations — we have it covered.
          </div>
          {moduleCategories.map((cat) => (
            <div key={cat.category} className={classes.moduleCategory}>
              <div className={classes.moduleCategoryTitle}>{cat.category}</div>
              <div className={classes.moduleBadges}>
                {cat.modules.map((mod) => (
                  <Badge key={mod} variant="light" color="primary" size="lg" radius="sm">
                    {mod}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open Source */}
      <section id="open-source" className={classes.openSource}>
        <div className={classes.sectionInner}>
          <div className={classes.sectionTitle}>Built for Hospitals, by Developers</div>
          <div className={classes.sectionSubtitle}>
            Self-host in minutes. Contribute to the future of healthcare software.
          </div>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <Card className={classes.osCard} shadow="none">
              <ThemeIcon variant="light" size={44} radius="sm" color="primary" mx="auto" mb="md">
                <IconServer size={22} stroke={1.5} />
              </ThemeIcon>
              <div className={classes.osCardTitle}>Quick Start</div>
              <div className={classes.codeBlock}>
                {"docker compose up -d\ncargo run\npnpm dev"}
              </div>
            </Card>
            <Card className={classes.osCard} shadow="none">
              <ThemeIcon variant="light" size={44} radius="sm" color="primary" mx="auto" mb="md">
                <IconBrandGithub size={22} stroke={1.5} />
              </ThemeIcon>
              <div className={classes.osCardTitle}>Open Source</div>
              <div className={classes.osCardDesc}>
                MIT licensed. Star us on GitHub, report issues, suggest features.
                The code is yours to audit, modify, and deploy.
              </div>
            </Card>
            <Card className={classes.osCard} shadow="none">
              <ThemeIcon variant="light" size={44} radius="sm" color="primary" mx="auto" mb="md">
                <IconCertificate size={22} stroke={1.5} />
              </ThemeIcon>
              <div className={classes.osCardTitle}>NABH / JCI Ready</div>
              <div className={classes.osCardDesc}>
                Built with 700+ compliance criteria from NABH and JCI standards.
                34 department evaluation checklists included.
              </div>
            </Card>
          </SimpleGrid>
        </div>
      </section>

      {/* Footer */}
      <footer className={classes.footer}>
        <div className={classes.footerInner}>
          <div className={classes.footerGrid}>
            <div className={classes.footerBrand}>
              <Group gap={10}>
                <img src="/logo/medbrains-mark.svg" alt="" width={28} height={28} style={{ borderRadius: 5 }} />
                <span className={classes.footerBrandName}>MedBrains</span>
              </Group>
              <span className={classes.footerBrandDesc}>
                Comprehensive Hospital Management System for modern healthcare.
                Open source, multi-tenant, and compliance-ready.
              </span>
            </div>

            <div>
              <div className={classes.footerColTitle}>Product</div>
              <ul className={classes.footerLinks}>
                <li><a href="#features" className={classes.footerLink}>Features</a></li>
                <li><a href="#modules" className={classes.footerLink}>Modules</a></li>
                <li><span className={classes.footerLink} onClick={() => navigate("/onboarding")}>Get Started</span></li>
              </ul>
            </div>

            <div>
              <div className={classes.footerColTitle}>Resources</div>
              <ul className={classes.footerLinks}>
                <li><span className={classes.footerLink}>Documentation</span></li>
                <li><span className={classes.footerLink}>API Reference</span></li>
                <li><span className={classes.footerLink}>Changelog</span></li>
              </ul>
            </div>

            <div>
              <div className={classes.footerColTitle}>Community</div>
              <ul className={classes.footerLinks}>
                <li>
                  <a
                    href="https://github.com/nicholasraman/medbrains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.footerLink}
                  >
                    GitHub
                  </a>
                </li>
                <li><span className={classes.footerLink}>Discussions</span></li>
                <li><span className={classes.footerLink}>Contributing</span></li>
              </ul>
            </div>
          </div>

          <div className={classes.footerBottom}>
            <span className={classes.footerCopyright}>
              v0.1.0 &middot; MIT License &middot; {new Date().getFullYear()} MedBrains
            </span>
            <Group gap={8}>
              <IconHeartRateMonitor size={16} color="var(--mb-text-muted)" />
              <span className={classes.footerCopyright}>
                Built with Rust, React &amp; Mantine
              </span>
            </Group>
          </div>
        </div>
      </footer>
    </div>
  );
}
