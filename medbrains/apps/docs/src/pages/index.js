import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

// Only pages that exist: the build fails on a broken link, so a role without a guide gets no card.
const ROLES = [
  { to: "/user-guides/front-office/", title: "Front office", text: "Register patients, book visits and hand out tokens." },
  { to: "/user-guides/doctor/", title: "Doctor", text: "See your queue, write the consultation, order tests." },
  { to: "/user-guides/nurse/", title: "Nurse", text: "Vitals, medicines on the MAR and shift handover." },
  { to: "/user-guides/pharmacist/", title: "Pharmacy", text: "Dispense, sell at the counter, controlled drugs." },
  { to: "/user-guides/lab/", title: "Lab", text: "From sample to verified report." },
  { to: "/user-guides/billing/", title: "Billing", text: "Bills, payments, refunds and closing the day." },
  { to: "/admin/", title: "Hospital IT and admin", text: "Set up the box, add staff and join ward PCs." },
  { to: "/developer/", title: "Developer", text: "Architecture, running it locally and contributing." },
];

const TASKS = [
  { to: "/user-guides/front-office/register-a-patient/", label: "Register a patient" },
  { to: "/user-guides/front-office/start-an-opd-visit/", label: "Start an OPD visit" },
  { to: "/user-guides/doctor/consultation/", label: "Write and sign a consultation" },
  { to: "/user-guides/doctor/order-a-lab-test/", label: "Order a lab test and read the result" },
  { to: "/user-guides/pharmacist/", label: "Dispense a prescription" },
  { to: "/admin/join-a-machine/", label: "Join a ward PC to the main box" },
  { to: "/get-started/first-patient-end-to-end/", label: "Follow your first patient, end to end" },
];

const CHAPTERS = [
  { to: "/overview/", label: "Overview" },
  { to: "/get-started/", label: "Get started" },
  { to: "/install/", label: "Install" },
  { to: "/user-guides/", label: "User guides" },
  { to: "/admin/", label: "Admin guide" },
  { to: "/compliance/", label: "Compliance" },
  { to: "/developer/", label: "Developer guide" },
  { to: "/operate/", label: "Operate" },
  { to: "/release-notes/", label: "Release notes" },
];

const APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MedBrains",
  applicationCategory: "MedicalApplication",
  operatingSystem: "Linux, Windows, macOS, iOS, Android",
  description: "Open-source hospital management software: registration, OPD, wards, pharmacy, lab, billing, and a hospital OS appliance.",
  url: "https://docs.medbrains.in/",
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
};

/** One titled list of links, each row separated by a thin rule. */
function LinkList({ id, title, items }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>{title}</h2>
      <ul className={styles.list}>
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to}>{i.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The docs home: a hero, a card per role, then common tasks and every chapter. */
export default function Home() {
  return (
    <Layout
      title="MedBrains documentation"
      description="Guides for MedBrains hospital management software, by role. Learn to register patients, run OPD, pharmacy and billing, set up the hospital box, or build on it."
    >
      <Head>
        <script type="application/ld+json">{JSON.stringify(APP_SCHEMA)}</script>
      </Head>
      <header className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>MedBrains · Documentation</p>
          <h1 className={styles.title}>MedBrains documentation</h1>
          <p className={styles.lede}>
            Run a whole hospital: how to use it, set it up and build on it. Start with your role, or search at the top.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} to="/get-started/">Get started</Link>
            <Link className={styles.secondary} href="https://www.medbrains.in/download">Download</Link>
          </div>
        </div>
      </header>
      <main className={styles.inner}>
        <section aria-labelledby="roles" className={styles.block}>
          <h2 id="roles" className={styles.heading}>Start with your role</h2>
          <ul className={styles.cards}>
            {ROLES.map((r) => (
              <li key={r.to} className={styles.card}>
                <h3 className={styles.cardTitle}>{r.title}</h3>
                <p className={styles.cardText}>{r.text}</p>
                <Link to={r.to} aria-label={`Read the ${r.title} guide`}>Read →</Link>
              </li>
            ))}
          </ul>
        </section>
        <div className={`${styles.block} ${styles.columns}`}>
          <LinkList id="tasks" title="Common tasks" items={TASKS} />
          <LinkList id="chapters" title="All chapters" items={CHAPTERS} />
        </div>
      </main>
    </Layout>
  );
}
