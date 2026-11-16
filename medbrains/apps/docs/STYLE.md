# MedBrains documentation style guide

How to write a page for the MedBrains documentation site (`medbrains/apps/docs`, served at
`/help` in the app and at docs.medbrains.in). Read it before you write or review a page.

This guide extends [`CARBON-CONTENT-RULES.md`](../../docs/CARBON-CONTENT-RULES.md) (plain, human,
sentence case) and [`WCAG-2.2-RULES.md`](../../docs/WCAG-2.2-RULES.md). Where they cover the same
point, they agree; where this guide is more specific, it applies to the docs site.

The people who read these pages run hospitals. A wrong step can stop a ward, lose a backup or
expose a record. Write so that a careful person, reading in a second language at the end of a
night shift, does the right thing the first time.

## Where it comes from

We read three documentation sites that are widely used and widely trusted: the CrateDB guide,
the Argo CD docs and the Python docs. They share six habits, and this guide is built on them.

1. **Pages have a type.** Each site separates learning pages, task pages, reference and
   background, even when it does not name the split. Python's landing page labels its tutorial
   "Start here", and keeps the library reference apart from the HOWTOs.
2. **The first lines say what the page is for.** Argo CD's overview opens with a one-line
   definition ("a declarative, GitOps continuous delivery tool"); CrateDB's admin index is one
   sentence and a list of links. No warm-up paragraphs.
3. **Instructions are imperative and in the present tense.** "Run", "replace", "make sure". The
   reader is "you". Reference entries start with a verb ("Return the …") and stay impersonal.
4. **Commands are complete and copyable.** No shell prompt in the block, placeholders marked
   (`<version>`), and the output shown where the reader must compare it.
5. **Callouts are rare and mean something.** A warning is kept for a consequence that is hard to
   undo, such as data lost when a container stops. Most caveats are a sentence in the step.
6. **Versions are explicit.** Python labels every change ("Added in version", "Changed in
   version") and every platform limit ("Availability: Unix"); Argo CD ties upgrade risk to patch,
   minor and major.

Where they differ: CrateDB writes cards and short blurbs and uses "we"; Argo CD bundles several
actions in one numbered heading; Python's HOWTOs are long, discursive and sometimes
conversational. We take the strictest of each: no "we" in instructions, one action per step,
and no chatty asides.

## The four page types

Every page is one of these. Decide which before you write, and do not mix them: a how-to that
stops to explain the architecture becomes hard to follow, and a reference page with steps is
hard to scan. Link to the other type instead.

| Type | Answers | Our sections |
|---|---|---|
| **Tutorial** | "Teach me, start to finish" | `get-started/` |
| **How-to** | "How do I do this one task?" | `install/`, `admin/`, `operate/`, `user-guides/` |
| **Reference** | "What exactly is X?" | `developer/reference/`, generated API and environment pages |
| **Explanation** | "Why does it work this way?" | `get-started/what-medbrains-is.md`, `compliance/`, background sections of `developer/` |

Release notes (`release-notes/`) are reference pages with a fixed shape (see below).
Troubleshooting pages are how-to pages arranged by symptom.

### Tutorial template

```markdown
---
title: <What the reader will have done>
description: "<140-160 characters: who it is for and what they end with>"
---

# <Title>

**Who:** <one role>.
**Time:** about <N> minutes.
**You need:** <accounts, machines, files, each linked>.

By the end you will have <one concrete result>.

## 1. <First action>

<One action.> **Expected:** <what the screen or command shows>.

## 2. <Next action>

...

## What you did

<Two or three sentences.> Next: [<the next page>](/path/).
```

### How-to template

```markdown
---
title: <Verb + object, e.g. "Restore a backup">
description: "<140-160 characters>"
---

# <Title>

**Who:** <role, and the permission it needs>.
**You need:** <prerequisites>.

<One or two sentences: what this does and when to do it. Any consequence that cannot be undone
goes here, before the first step.>

## 1. <Action>

1. <One action.>
2. <One action.> **Expected:** <result>.

## Check it worked

<A command, a screen or a log line that proves success.>

## If something goes wrong

| What you see | Why | What to do |
|---|---|---|
```

### Reference template

```markdown
---
title: <The thing, as a noun: "Environment variables">
description: "<140-160 characters>"
---

# <Title>

<One sentence: what this lists and where it comes from (the source file, if generated).>

| Name | Type | Default | Since | What it does |
|---|---|---|---|---|
| `NAME` | string | `x` | 3.33.0 | <Starts with a verb: "Sets the …"> |
```

Each entry starts with a verb in the present tense and states defaults, units and limits. A
generated page names its generator and is never edited by hand.

### Explanation template

```markdown
---
title: <The idea, as a noun phrase: "How updates stay safe">
description: "<140-160 characters>"
---

# <Title>

<The question this page answers, in one sentence.>

## <Point 1>

<Prose. Diagrams welcome. No steps: link to the how-to.>

## Related

- [<How-to that uses this>](/path/)
```

## Voice

- **Address the reader as "you"**, and give instructions in the imperative: "Open **Admin** →
  **Machines**", not "The user should open" or "We will now open".
- **Present tense.** "The installer erases the disk", not "will erase". Use the future only for
  something that happens later in time ("it restarts in 15 seconds").
- **Active voice.** Name who does what: "MedBrains signs the backup", not "the backup is signed".
- **Short sentences,** about 20 words or fewer. One idea per sentence.
- **Say "MedBrains"** for the product, not "we", "our platform" or "the system". "We" is for the
  project people only, and only outside instructions (release notes, contributing).
- **No opinions about difficulty.** The reader decides what is easy.
- **Spelling:** British English, as in the rest of the repository (licence, organisation,
  colour, programme for a plan, program for software).
- **Sentence case** for titles, headings, table headers and link text. Capitalise only the first
  word, proper nouns and product names.
- **UI labels in bold, exactly as on screen,** with `→` between steps of a path: **Admin** →
  **Settings** → **System Health**. Keys in `Ctrl` + `C` form. File names, commands, flags and
  values in `code`.

## Prerequisites

Put them at the top, before any step, in this order and these words:

- **Who:** the role that does the task, and the permission if it is not obvious.
- **Time:** only when it is more than a few minutes, or the reader must plan for it (a backup
  restore, a first install).
- **You need:** every account, machine, file, version and tool, each linked to where to get it.
  Give the minimum version ("cosign 2 or later").

A reader who reaches step 3 and finds a missing prerequisite has wasted the first two steps,
and on a live system may have left it half changed.

## Steps

- **Number the steps.** Use numbered `##` headings for stages and a numbered list for the
  actions inside a stage.
- **One action per step.** "Type the disk name" and "Type `ERASE <name>`" are two steps.
- **Then the result.** After an action whose result the reader must see, write
  **Expected:** and what appears: a screen, a message, or the exact output in a `text` block.
- **Then the check.** End the task with **Check it worked**: a command, a screen or a log line
  that proves success, independent of the steps.
- **Condition first, action second:** "If the stick is not listed, reconnect it", not "Reconnect
  the stick if it is not listed".
- **Warnings come before the action they qualify,** never after.
- **Optional steps say so** in the step: "(Optional) Add a second administrator."

## Admonitions

Docusaurus gives five: `note`, `tip`, `info`, `warning` and `danger`. Use them rarely. A page
with four callouts has none that the reader notices. If it fits in a sentence of the step, write
the sentence.

| Kind | Use it for | Example |
|---|---|---|
| `note` | Context the reader may need but can skip | Which versions a step applies to |
| `tip` | A faster or better alternative that is optional | A keyboard shortcut, a script that does the same |
| `warning` | An action that can break a running system, but can be undone | Restarting services during clinic hours |
| `danger` | An action that loses data, exposes patient data or harms safety, and cannot be undone | Erasing a disk, deleting a key, committing real patient data |

Do not use `info` or `caution` in new pages; use `note` and `warning`. Give each callout a title
that states the point ("The container's data is lost when it stops"), not "Note" or "Important".
Say what happens and what to do instead.

## Code and commands

- **Copyable as written.** No `$` or `#` prompt, no output mixed into a command block, no
  ellipses. One block per thing the reader runs.
- **Real names and versions:** `medbrains-os-v3.33.0-x86-64.iso`, not `the-iso-file`. Put the
  version in a variable once when a block uses it repeatedly (`VER=3.33.0`).
- **Placeholders** in angle brackets and capitals, explained in the sentence before:
  "Replace `<DISK>` with the name from step 2." Never a placeholder that also works as a real
  value.
- **Tag every block** with its language: `bash`, `powershell`, `text` for output, `yaml`, `json`.
- **Say which system** when a command differs: put Linux, macOS and Windows variants in
  separate blocks, each labelled, or in tabs.
- **Dangerous commands** (`dd`, `rm -rf`, dropping a database) get a `danger` callout before
  the block and a step that confirms the target first (`lsblk`).
- **Line length:** break long commands with `\`, one flag per line when there are more than
  three.

## Versions and the release calendar

MedBrains has one product version (`MAJOR.MINOR.PATCH`, see
[`COMPATIBILITY.md`](../../docs/COMPATIBILITY.md) §1) and releases on fixed dates: patch day on
the second Tuesday of each month, a feature release each quarter, a release candidate two weeks
before it (the release calendar in `COMPATIBILITY.md`).

- **Label what is version-specific** with the version it arrived in: "Added in 3.34.0",
  "Changed in 3.34.0: …", "Removed in 4.0.0". Put the label at the end of the section it
  describes, in a `note` when it changes what the reader does.
- **A planned feature names its release,** from the calendar: "Planned for 3.34.0
  (2027-02-09)". Never "coming soon", "soon" or "in a future release" without a version or
  date. If there is no date, say it is not available and link the issue.
- **A page with no label applies to every supported version.** When that stops being true, add
  the label; do not rewrite the page for the newest version only.
- **Support dates** go in a Markdown table, so CI can check that they only get longer
  (`COMPATIBILITY.md` §4).
- **Release notes** follow the CHANGELOG: one section per version, written for a hospital IT
  team, with "Upgrade notes" first when there are any.

## Clinical and safety language

Documentation is not medical advice, and MedBrains does not practise medicine.

- **Describe what the software does, not what a clinician should decide.** "MedBrains shows an
  allergy warning when a prescribed drug matches a recorded allergy", not "MedBrains prevents
  allergic reactions".
- **Never overclaim.** No "guarantees", "prevents errors", "100% accurate", "fully compliant".
  State what is checked, when, and what happens on failure. A check that only warns is called a
  warning, not a block.
- **Regulation by name and scope.** Name the rule and the country: "the NDPS Act 1985 (India)",
  "DPDP Act 2023 (India)". Say "built for" or "designed to support" a standard until a
  certification exists, and link it when it does. Never "certified", "approved" or "compliant"
  without the certificate.
- **AI output is labelled as assistive.** A clinician reviews and accepts it; the page says so.
- **Precise clinical terms, units and codes.** Keep clinical content exact (doses with units,
  INN drug names, ICD/LOINC codes); keep everything around it plain.
- **Synthetic data only** in examples and screenshots: invented names, no real phone numbers,
  IDs or records ([`CONTRIBUTING.md`](../../../CONTRIBUTING.md)).
- **Safety-critical text is direct.** For an emergency code or a step that can harm a patient,
  put the action first and the reason second.

## A global audience

MedBrains is built for hospitals anywhere. India is the first country pack, not the default
reader.

- **Write for a reader in any country,** then add the country pack's rules in a clearly
  labelled section ("India: ABDM").
- **Spell out an acronym on first use** on every page: "Ayushman Bharat Digital Mission
  (ABDM)". Readers arrive from search, not from page one.
- **Dates as ISO 8601** (`2027-02-09`), times in 24-hour form with the time zone when it
  matters. Units in SI. Currency with its ISO code (INR 500, USD 20).
- **No idioms, slang or cultural references** ("out of the box", "a piece of cake", "ballpark").
  They do not survive translation and confuse second-language readers.
- **Translation-friendly sentences:** one clause where possible, the subject stated, no
  dropped articles, no long noun stacks ("database backup encryption key rotation schedule"),
  no "e.g." or "i.e." (write "for example" and "that is").

## Inclusive and accessible language

- **Person-first** for health conditions ("a person with diabetes"), and neutral about gender:
  "they", "the nurse", "the administrator".
- **No ableist or violent metaphors:** not "sanity check" (use "quick check"), "crippled", "kill"
  for a process when "stop" works, "blacklist/whitelist" (use "denylist/allowlist"),
  "master/slave" (use "primary/replica").
- **Link text names its target:** "see [verify a download](/install/verify-a-download/)", never
  "click here" or "this link". Never "click" for an action: write "select", which also covers
  touch and keyboard.
- **Never colour or position alone:** not "the red button" or "the box on the right"; name it.
- **Every image has alt text** that says what it shows and why it matters, and a caption when
  the reader must compare it with their screen. Do not put information only in an image.
- **Headings in order** (`#` once, then `##`, `###`; never skip a level), so screen readers can
  navigate the page.
- **Tables for comparisons only,** with a header row; not for layout.

## Terminology

Use these words, and only with these meanings. Checked against the code, `RFC-HOSPITAL-OS.md`
and the existing pages on 2026-11-14.

| Term | Means | Notes |
|---|---|---|
| **MedBrains** | The product as a whole | Never "Medbrains", "MB" or "the platform" |
| **MedBrains OS** | The Linux-based operating system image that runs a hospital's machines | Not "the distro" |
| **main machine** | The machine that holds the hospital's database and system of record | The installer and **Admin** → **Machines** say "main machine". Pick it over "main box" and "server" in new pages; existing pages use both (see the backlog below) |
| **box** | Informal for a MedBrains OS appliance. Use only as "edge box" (a small appliance for a camp or site that can run offline) | Avoid "the box" for the main machine |
| **node** | Architecture term: any machine other than the main machine. It holds no system of record | Use in explanation and developer pages. In admin how-tos, say what it is: "workstation", "display" |
| **workstation**, **display** | The two types a joined machine can have: staff sign in and work, or it shows a queue board | As chosen on the join screen |
| **hospital** | One customer organisation and its data, in everything a hospital reads | Never "tenant" in user-facing pages |
| **tenant** | The same thing in code and developer pages: rows carry `tenant_id` and row-level security | Use only in `developer/` pages |
| **campus**, **building**, **floor**, **department** | The location layers below a hospital, in that order | Matches the seven configuration layers |
| **country pack** | The rules, codes and integrations for one country (India: ABDM, NABH, DPDP, NDPS, Schedule H) | Not "localisation" or "India version" |
| **module** | A feature area a hospital turns on or off (OPD, pharmacy, laboratory) | In developer pages, the code unit is a **brick**; do not use "brick" for readers |
| **episode** | A clinical period with a start and an end that the law or the record tracks as one unit, for example a Mental Healthcare Act admission episode or a restraint episode | Not a synonym for visit or encounter |
| **visit** | One OPD attendance | "Start an OPD visit" |
| **admission** | An inpatient stay | Not "IPD visit" |
| **role**, **permission** | A role groups permissions; a permission allows one action on one kind of record | Name the permission by its label, then its code in `code` |
| **kernel** | The `medbrains-kernel` crate: the shared services every app reaches through | Developer pages only |
| **release**, **patch day**, **feature release**, **release candidate** | As defined in the release calendar (`COMPATIBILITY.md`) | |
| **sign in** / **sign out** | The verbs | Not "log in" or "login" (noun: "sign-in") |

Add a term to this table in the same PR that introduces it.

## Words to avoid

| Avoid | Why | Write instead |
|---|---|---|
| simply, just, easy, easily, obviously, of course, straightforward | They tell a reader who is stuck that the problem is them | Cut the word |
| free, for free | Ambiguous: price or freedom; and a promise about cost | "open source", "no licence fee" |
| seamless, effortless, powerful, robust, world-class, cutting-edge, state-of-the-art, revolutionary, next-generation | Marketing: claims without evidence | Say what it does, with a number if there is one |
| guarantee, prevents, 100%, fully compliant, unhackable | Overclaims, and dangerous ones in a hospital | What is checked and what happens on failure |
| coming soon, soon, in a future release | No date | "Planned for 3.34.0 (2027-02-09)", or "not available yet" with the issue link |
| please, in order to, utilise, leverage | Filler | Cut, "to", "use" |
| click here, read more, this link | Meaningless out of context | Link text that names the target |
| we (in instructions) | The reader does the task, not us | "you", or the imperative |
| etc., and so on | The reader cannot know what is included | List the items, or "for example" |
| should (for a required step) | Reads as optional | "must", or the imperative |

`scripts/check-prose.mjs` reports most of these and Title Case headings (`pnpm --filter
@medbrains/docs lint:prose`). It is report-only while the pages written before this guide are
cleaned up; then CI switches it to `--strict`.

## Reviewer checklist

Apply it to every docs PR. A box left unticked is a review comment.

- [ ] The page is one type (tutorial, how-to, reference or explanation) and sits in that
      type's section.
- [ ] The title and first lines say what the page is for; the description is 140–160 characters.
- [ ] **Who** and **You need** come before the first step, with versions and links.
- [ ] One action per step; **Expected:** after each step with a visible result; a **Check it
      worked** at the end of a task.
- [ ] Anything that cannot be undone is a `danger` callout before the step, and callouts are
      few and titled.
- [ ] Every command runs as written: no prompts, real file names, versions, placeholders
      explained, language tag on every block.
- [ ] Version-specific content is labelled; nothing says "coming soon" without a release or date.
- [ ] Clinical and regulatory text describes what the software does, names the law and the
      country, and claims no certification it does not have.
- [ ] Terms match the terminology table (main machine, hospital, sign in, …).
- [ ] No banned words; sentence-case headings; British spelling.
- [ ] No idioms; acronyms spelled out on first use; dates in ISO form.
- [ ] Link text names its target; images have alt text; no meaning by colour or position alone.
- [ ] Examples and screenshots hold synthetic data only.
- [ ] `pnpm --filter @medbrains/docs build` passes, and `lint:prose` reports nothing new.
