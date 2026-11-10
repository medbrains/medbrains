// /os, the landing page's OS section and llms.txt read from here, so they never disagree.
//
// Honesty rule: every line is true on origin/main today or says it is not done. Sources:
// medbrains/RFCs/RFC-HOSPITAL-OS.md (§8a, §8p hardware tiers, §8s roles and joining) and
// medbrains/os/README.md ("Joining a machine", "Measured", "What is in D1, and what is not").
// Hardware rows are recommendations from the RFC, not tested kits; nothing has run on a Pi yet.

/** The four machine roles chosen on the first-boot screen; status marks the ones not built. */
export const OS_ROLES = [
  {
    title: "Server",
    body: "Holds the database and the records, signs people in with a password and an authenticator app, issues the machines' certificates and lists every machine on its Nodes screen.",
    status: "",
  },
  {
    title: "Workstation",
    body: "Where staff sign in and work. It keeps no patient data, or only what offline mode needs.",
    status: "",
  },
  {
    title: "Display",
    body: "A queue board or TV. It keeps no patient data.",
    status: "Joins today; the board is not built yet",
  },
  {
    title: "Ward backup",
    body: "Keeps a ward running if the server or the network fails, with its data encrypted.",
    status: "Planned",
  },
];

/** How a new machine joins the hospital, in the order a person sees it. */
export const OS_JOIN = [
  "On the new machine, choose “Connecting to my hospital”. It finds the server on the local network, or you type its address.",
  "The new machine shows a code. An administrator types it on the server’s Machines screen to approve it, and the approval is recorded in the audit log.",
  "The server then shows a second code for the new machine, so the new machine knows it found the real server and not an impostor.",
  "Removing a machine ends its access at once. A machine that is switched off learns this when it reconnects.",
  "Changing a machine’s role is a deliberate reset, never a silent switch.",
];

/** Why the OS is built the way it is: the pitch, each line backed by the design above. */
export const OS_WHY = [
  { title: "Cheap by design", body: "Free and open source. Only the server needs real hardware; every other machine runs on the smallest box that does its job." },
  { title: "Simple out of the box", body: "Plug in, answer a few plain questions on the machine’s own screen, and it starts. No command line." },
  { title: "Safe by default", body: "The firewall is on before the first boot, the data disk is encrypted where the machine has a TPM chip, and services run directly on Linux with no Docker." },
  { title: "Ready for the auditor", body: "Every sign-in, every record opened and every machine approved is in the audit log." },
  { title: "Replace a machine in minutes", body: "Nodes hold no system of record, so a broken one is swapped, not repaired on the ward." },
  { title: "Work that stays local", body: "Built on common open parts, so a local IT firm can install it and look after it." },
];

/** Suggested hardware per job. Recommendations from the RFC, not tested kits. */
export const OS_HARDWARE = [
  { job: "Server for a small clinic", kit: "Raspberry Pi 5 with 8 GB of memory and an NVMe SSD, with active cooling. Not an SD card: it wears out under a database." },
  { job: "Server for a hospital", kit: "Any x86-64 or arm64 PC or small server. Keep a second one as a standby, because one server is a single point of failure." },
  { job: "Workstations and displays", kit: "The smallest x86-64 or arm64 machine that drives the screen. They hold no records, so they can be cheap." },
  { job: "Local AI (optional)", kit: "A mini PC with a built-in AI chip, or a graphics card. Never required: every feature also runs on the processor." },
];

/** Figures measured so far, each with where it was measured. */
export const OS_MEASURED = [
  { value: "300 MB", label: "memory used by a workstation node at its desktop, in a virtual machine" },
  { value: "≤ 2 s", label: "from removing a machine to its access ending, in a virtual machine" },
  { value: "320 kB", label: "the web app’s first page, compressed" },
];

/** What is not done yet. Said plainly, and kept current. */
export const OS_NOT_DONE = [
  "Signed A/B updates with automatic rollback are in review, not released.",
  "The display board and the ward backup role are not built.",
  "Verified boot and keeping machine keys in the TPM are still in progress.",
  "Nightly backups on the OS are not switched on yet.",
  "Tested only in virtual machines: not yet on real hardware or a Raspberry Pi.",
  "No outside penetration test yet, and no hospital runs it in production yet.",
];

/** Questions for /os and its FAQPage schema. */
export const OS_FAQ = [
  {
    q: "Is MedBrains OS locked to one app?",
    a: "No. It opens to a desktop with a dock and a launcher, like any computer, and each app opens in its own sandboxed view. MedBrains is one of the apps. Others, such as imaging, lab or a hospital’s own, get a tile the same way; installing them from the screen is planned.",
  },
  {
    q: "Do I need a different image for each kind of machine?",
    a: "No. There is one image per processor type, x86-64 and arm64. The same OS runs on every machine, and you choose its role on the first-boot screen.",
  },
  {
    q: "Does it need the internet?",
    a: "No. Setup and daily work run on the hospital’s own network. The internet is used for updates and optional cloud services.",
  },
  {
    q: "Can I run it today?",
    a: "You can build the image and boot it in a virtual machine from the open source repository. It is not yet ready for a hospital in production; the list above says what is still missing.",
  },
];
