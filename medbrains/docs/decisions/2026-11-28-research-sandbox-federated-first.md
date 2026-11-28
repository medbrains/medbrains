---
date: 2026-11-28
status: decided
---
# Research sandboxes run on each hospital's box first

**What.** A researcher who needs their own analysis code gets a study sandbox on each hospital's box: a per-study de-identified extract with per-study pseudonyms, an isolated workspace with no network and no export, and only checked aggregates leaving through the release checker and a person's click. The certificate gate (ethics approval, protocol, data use agreement, investigator) comes first.

**Why.** It keeps the network's promise that data never leaves the hospital, is the cheapest to run (hospitals' own boxes), and carries the lowest legal and security risk. Most studies still use the restricted query language and need no sandbox.

**Rejected for now.** A central sandbox with linked data from several hospitals, run by the custodian: it is the only way to follow one patient across hospitals, but de-identified data is still personal data, the custodian would hold a high-value target, and it needs counsel's sign-off and a custodian that exists. Revisit after section 17's answers.
