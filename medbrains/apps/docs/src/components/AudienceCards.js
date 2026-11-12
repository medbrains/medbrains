import Link from "@docusaurus/Link";

const CARDS = [
  { to: "/user-guides/", title: "I work at a hospital", text: "Step-by-step guides for your role: front office, doctor, nurse, pharmacy, lab, billing." },
  { to: "/admin/", title: "I set up and run it", text: "Install the box, add staff and roles, join ward PCs, keep it backed up." },
  { to: "/developer/", title: "I build on it", text: "Architecture, running it locally, tests, the API reference and how to contribute." },
];

/** The home page's three ways in, one per audience. */
export default function AudienceCards() {
  return (
    <nav aria-label="Choose your path" className="mb-cards">
      {CARDS.map((c) => (
        <Link key={c.to} to={c.to} className="mb-card">
          <strong>{c.title}</strong>
          <span>{c.text}</span>
        </Link>
      ))}
    </nav>
  );
}
