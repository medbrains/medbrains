# Acknowledgements

MedBrains exists because thousands of people gave their work away. This page thanks the open-source projects it is built on, and the standards, books and design systems whose ideas shaped it.

The complete list, every Rust crate and npm package with its version and licence, is in the CycloneDX SBOM attached to [each release](https://github.com/medbrains/medbrains/releases). This page names the ones you would notice if they were gone.

## The open source MedBrains is built on

### Server and data

| Project | What it does for MedBrains |
|---|---|
| [Rust](https://www.rust-lang.org/) | The language of the server, the OS tools and the desktop shell |
| [Tokio](https://tokio.rs/) | Runs everything asynchronously |
| [Axum](https://github.com/tokio-rs/axum) and [Tower](https://github.com/tower-rs/tower) | The HTTP server and its middleware |
| [PostgreSQL](https://www.postgresql.org/) | The single source of truth, with row-level security keeping hospitals apart |
| [SQLx](https://github.com/launchbadge/sqlx) | Database queries checked against the schema at compile time |
| [Serde](https://serde.rs/) | Every JSON request and response |
| [tracing](https://github.com/tokio-rs/tracing) | Structured logs |
| [rustls](https://github.com/rustls/rustls) | TLS without OpenSSL where we can |
| [Pingora](https://github.com/cloudflare/pingora) | The front proxy on the MedBrains OS |
| [Kanidm](https://kanidm.com/) | Staff identity and single sign-on |
| [SpiceDB](https://authzed.com/spicedb) | Relationship-based access checks, the second authorization backend |
| [Orthanc](https://www.orthanc-server.com/) | The DICOM server for radiology images |
| [iroh](https://www.iroh.computer/) | Peer-to-peer sync between devices when the network is down |
| [Loro](https://loro.dev/) | Conflict-free merging of offline edits |
| [UniFFI](https://github.com/mozilla/uniffi-rs) | Shares the Rust core with the Swift and Kotlin apps |
| [mlua](https://github.com/mlua-rs/mlua) | Safe scripting for hospital rules |
| [Rig](https://github.com/0xPlaygrounds/rig) | The AI agent layer |
| [age](https://github.com/str4d/rage) | Encrypts backups |
| [Tauri](https://tauri.app/) | The desktop app |
| [Rustrak](https://github.com/rustrak/rustrak) and the [Sentry SDKs](https://github.com/getsentry) | Error tracking, kept on the hospital's own server by default |

### Web app

| Project | What it does for MedBrains |
|---|---|
| [React](https://react.dev/) | The web app |
| [Mantine](https://mantine.dev/) | Every button, form, table and dialog, accessible out of the box |
| [Vite](https://vite.dev/) | Builds and serves the web app |
| [TanStack Query](https://tanstack.com/query) | Server data, cached and kept fresh |
| [Zustand](https://github.com/pmndrs/zustand) | App state |
| [React Router](https://reactrouter.com/) | Navigation |
| [React Hook Form](https://react-hook-form.com/) and [Zod](https://zod.dev/) | Forms and the rules that check them |
| [Tiptap](https://tiptap.dev/) | Rich-text clinical notes |
| [Apache ECharts](https://echarts.apache.org/) and [Recharts](https://recharts.org/) | Charts |
| [React Flow](https://reactflow.dev/) | The workflow and form designer canvas |
| [dnd kit](https://dndkit.com/) | Drag and drop |
| [three.js](https://threejs.org/) | The 3D body map |
| [i18next](https://www.i18next.com/) | Translations |
| [Tabler Icons](https://tabler.io/icons) | Every icon |
| [IBM Plex](https://github.com/IBM/plex) and [Archivo](https://github.com/Omnibus-Type/Archivo) | The typefaces |
| [dotLottie](https://dotlottie.io/) | The small animations |

### Building, testing and shipping

| Project | What it does for MedBrains |
|---|---|
| [pnpm](https://pnpm.io/) and [Turborepo](https://turborepo.com/) | The monorepo |
| [Biome](https://biomejs.dev/) | Lint and format |
| [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/) | Unit tests and whole-journey tests |
| [cargo-zigbuild](https://github.com/rust-cross/cargo-zigbuild) and [Zig](https://ziglang.org/) | Cross-compiling for hospital servers |
| [Sigstore](https://www.sigstore.dev/) | Signing every release, keyless |
| [Syft](https://github.com/anchore/syft) | The SBOM in every release |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog), [cargo-audit and cargo-deny](https://rustsec.org/) | Keeping secrets and known vulnerabilities out |
| [Docusaurus](https://docusaurus.io/) | The documentation site |
| [Debian](https://www.debian.org/) and [systemd](https://systemd.io/) | The base of the MedBrains OS |

## Ideas that shaped MedBrains

### Health standards

- [World Health Organization](https://www.who.int/): SMART Guidelines, ICD-11, the standardized clinical forms and the Global Health Observatory indicators
- [HL7 FHIR](https://hl7.org/fhir/), Structured Data Capture and [CQL](https://cql.hl7.org/), for exchanging records, forms and rules
- [openEHR](https://www.openehr.org/), whose archetypes inspired one shared model under many form layouts
- [SNOMED International](https://www.snomed.org/) and [LOINC](https://loinc.org/) from the Regenstrief Institute
- The [US National Library of Medicine](https://www.nlm.nih.gov/) and its open LHC-Forms work
- [DICOM](https://www.dicomstandard.org/) and [IHE](https://www.ihe.net/) profiles
- India's [Ayushman Bharat Digital Mission](https://abdm.gov.in/), the first country pack
- [NABH](https://nabh.co/) and [Joint Commission International](https://www.jointcommissioninternational.org/) standards, which became our checklists

### Engineering

- *Operating Systems: Three Easy Pieces* by Remzi and Andrea Arpaci-Dusseau
- Saltzer and Schroeder's design principles for protecting information
- Gerard Holzmann's "Power of Ten" rules for safety-critical code, from NASA's Jet Propulsion Laboratory
- The Unix philosophy
- [Semantic Versioning](https://semver.org/), [SLSA](https://slsa.dev/) and the [OpenSSF](https://openssf.org/)

### Design and writing

- [IBM Carbon Design System](https://carbondesignsystem.com/), for layout, motion, colour and content rules
- [Material Design 3](https://m3.material.io/) and Apple's Human Interface Guidelines, for the phone and tablet apps
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), so everyone can use MedBrains
- The documentation of [CrateDB](https://cratedb.com/docs/), [Argo CD](https://argo-cd.readthedocs.io/) and [Python](https://docs.python.org/3/), for how we try to write ours

## Missing someone?

If MedBrains uses your work and you are not here, we are sorry. Please [open an issue](https://github.com/medbrains/medbrains/issues/new) or a pull request and we will add you.
