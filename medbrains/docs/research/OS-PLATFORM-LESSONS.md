# What big OS platforms teach the MedBrains hospital OS

Research note, 2026-11-02. Read against `RFC-HOSPITAL-OS.md` (commit 900ed0d13) and
`docs/OS-PRINCIPLES.md`. Sources are linked inline. Items marked **[unverified]** are from general
knowledge and were not checked against a primary source in this pass.

## Top 10 lessons

1. **Never break the people building on you.** Linux's one hard rule is "we don't break user space";
   it lets the inside churn freely because the outside boundary is fixed. MedBrains needs the same
   written promise for its kernel interface and extension protocol.
2. **A boundary only holds if a test suite enforces it.** Android's fragmentation only began to ease
   when Treble put a versioned vendor interface behind a Vendor Test Suite. Build a compatibility test
   suite before the store.
3. **Developers decide which platform wins, not technical quality.** Windows Phone, Firefox OS and
   webOS were technically sound and died for lack of apps and users. Reuse an ecosystem that already
   exists (SMART on FHIR, CDS Hooks) before asking anyone to learn a new one.
4. **Third-party code must not be able to take down the machine.** The 2024 CrowdStrike outage
   (8.5 million Windows machines) came from a third-party driver running in kernel mode. Keeping
   extensions sandboxed and out of the kernel is right. Updates to extensions also need staged rollout.
5. **Updates must be automatic, staged and reversible.** ChromeOS (A/B partitions, release channels)
   and Windows Update rings show that rolling back on its own is only half the job. The other half
   is releasing to a few sites first, then to everyone.
6. **Publish an end-of-support date.** ChromeOS's fixed 10-year update promise and Debian/kernel LTS
   schedules let buyers plan. A hospital buying hardware needs the same.
7. **Prompts that fire too often teach people to click "yes".** Vista's UAC was, by Microsoft's own
   account, designed to annoy. Android moved to asking at the moment of use, one-time grants and
   automatic reset of grants an app no longer uses.
8. **Trust in open source is lost by changing the deal later.** Red Hat's CentOS Stream switch and
   its 2023 source-access change cost it a lot of goodwill. Write down early what will always stay
   free.
9. **Charging a fee on the way into healthcare data backfires.** Epic's App Orchard fees drew
   criticism and were cut. US rules now limit what certified EHR vendors may charge for API access.
10. **Health platforms that sit outside clinical work die.** Google Health and Microsoft HealthVault
    failed because they were not part of anyone's daily work. When they closed, giving users their
    data back was the one thing done well.

---

## 1. Linux

- **A fixed outside, a free inside.** Torvalds: "we simply do not break user space"; a kernel change
  that breaks a program gets fixed or reverted, whatever the program's fault
  ([LKML 2017](https://www.lkml.org/lkml/2017/10/26/524)). The kernel also refuses a stable
  *internal* driver API on purpose, so it can keep refactoring
  ([stable-api-nonsense](https://www.kernel.org/doc/html/latest/process/stable-api-nonsense.html)).
  *Lesson:* freeze the kernel interface and extension protocol; keep crates and internals free to change.
- **Distributions, not the kernel, reach users.** Debian, Ubuntu and RHEL package, test and support the
  kernel. Each has its own release and LTS calendar
  ([kernel.org releases](https://www.kernel.org/category/releases.html),
  [Debian LTS](https://wiki.debian.org/LTS)). *Lesson:* MedBrains should be a good upstream with a
  predictable calendar. That lets integrators package it and resell it.
- **Governance by maintainers.** Each subsystem has a named maintainer and changes go through review
  ([kernel process docs](https://www.kernel.org/doc/html/latest/process/index.html)). *Lesson:* the RFC
  already asks for two reviewers on kernel changes. Add named owners per subsystem.

## 2. macOS / iOS

- **Security in layers the user never sees:** a secure boot chain, a read-only signed system volume,
  sandboxing and code signing ([Apple Platform Security](https://support.apple.com/guide/security/welcome/web)).
  The RFC already copies these (§8j).
- **Notarisation is an automated malware scan, not a human review.** Apple's own page draws that line
  ([Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)).
  Full App Review is a separate, slower step
  ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). *Lesson:* use
  two levels. Every listed extension gets an automated scan and signature. Certified ones also get a
  human review.
- **Privacy labels that developers write themselves.** App Store privacy labels are self-declared by
  the developer ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)).
  Their accuracy has been publicly questioned **[unverified: press reports, 2021]**. *Lesson:* produce
  MedBrains labels from what the kernel actually enforces (the grants in the manifest), not from
  text the developer types.
- **Deprecation with a migration path.** Apple drops old technology on a schedule, and when it does,
  it ships a bridge such as Rosetta 2
  ([Rosetta](https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment)).
  *Lesson:* every protocol version comes with a support window and a migration tool or shim.

## 3. Windows

- **Backward compatibility as the moat.** Windows contained special cases to keep old apps running, for
  example a memory-allocator mode just for SimCity. Spolsky argued that Microsoft lost ground when it
  started putting new APIs ahead of compatibility
  ([How Microsoft Lost the API War](https://www.joelonsoftware.com/2004/06/13/how-microsoft-lost-the-api-war/)).
  *Lesson:* hospitals keep software for 10 years or more, so compatibility is worth more to them than
  new features.
- **Driver certification works, but kernel-mode third-party code is the weak point.** The Windows
  Hardware Compatibility Program built a huge driver base
  ([WHCP](https://learn.microsoft.com/en-us/windows-hardware/design/compatibility/)). In July 2024 a
  faulty CrowdStrike update crashed about 8.5 million machines, hospitals among them
  ([Microsoft](https://blogs.microsoft.com/blog/2024/07/20/helping-our-customers-through-the-crowdstrike-outage/)).
  *Lesson:* keep WASM and out-of-process extensions. Also stage extension updates, not only OS updates.
- **Prompt fatigue.** Microsoft's David Cross said in 2008 that UAC was put in "to annoy users", to
  push vendors to stop asking for admin rights
  ([Computerworld](https://www.computerworld.com/article/1505303/memo-to-microsoft-annoyance-is-not-a-security-plan.html)).
  *Lesson:* push the burden onto the extension developer, through narrow manifests and review, not
  onto clinicians.
- **Enterprise management.** Group Policy and Intune, together with Windows Update rings and deferral
  settings ([Windows Update for Business](https://learn.microsoft.com/en-us/windows/deployment/update/waas-manage-updates-wufb)),
  let IT decide *when* updates land. *Lesson:* hospitals need maintenance windows and deferrals. Nobody
  reboots a server during surgery.

## 4. Android

- **Open core plus proprietary services.** AOSP is open. Google Mobile Services (Play, Maps) are
  licensed only to makers who pass the Compatibility Definition Document and the Compatibility Test
  Suite ([CDD](https://source.android.com/docs/compatibility/cdd)). *Lesson:* Apache-2.0 allows anyone
  to fork. A trademark tied to passing a compatibility suite ("MedBrains Compatible") is what keeps
  forks interoperable.
- **Fragmentation and slow updates, then Treble and Mainline.** Treble separated vendor code behind a
  tested interface ([Here comes Treble](https://android-developers.googleblog.com/2017/05/here-comes-treble-modular-base-for.html)).
  Mainline then made core components updatable through Play
  ([Mainline](https://source.android.com/docs/core/ota/modular-system)). *Lesson:* design so that
  security fixes reach every install without waiting for a partner or integrator.
- **Permissions evolved toward fewer, smarter prompts:** asking at runtime (6.0), then one-time grants
  and automatic reset of grants for unused apps (11)
  ([Android 11 permissions](https://developer.android.com/about/versions/11/privacy/permissions)).
  *Lesson:* revoke extension grants automatically when an extension has gone unused.

## 5. ChromeOS

- **Verified boot plus A/B automatic updates.** The system is checked at every boot, the device
  repairs itself if the check fails, and updates are applied to the inactive slot
  ([Verified boot](https://www.chromium.org/chromium-os/chromiumos-design-docs/verified-boot/),
  [autoupdate design](https://www.chromium.org/chromium-os/chromiumos-design-docs/filesystem-autoupdate/)).
  This is the model the RFC follows in §8b, §8j and D4.
- **Release channels (stable, beta, dev)** let administrators keep part of the fleet on an earlier
  channel **[unverified: channel/LTS specifics]**.
- **A published support date for every model:** 10 years from platform release for devices from 2021
  onward ([Google support](https://support.google.com/chromebook/answer/9367166)). This has made
  schools buy cheap hardware with confidence.
- **Very little to manage.** Most state lives in the cloud and a device can be reset safely. *Lesson:*
  the more MedBrains state lives on the encrypted data partition plus backups, the more boxes can be
  treated as replaceable, which matches the RTO ≤ 1 h target in §8k.

## 6. Failures and near-failures

- **Symbian / Nokia.** Elop's 2011 "burning platform" memo blamed slow delivery and an ecosystem
  that was losing to iOS and Android
  ([Engadget](https://www.engadget.com/2011/02/08/nokia-ceo-stephen-elop-rallies-troops-in-brutally-honest-burnin/)).
  Being the market leader did not protect a platform developers found hard to build for.
- **Windows Phone.** Belfiore (2017): "We have tried VERY HARD to incent app devs. Paid money.. wrote
  apps 4 them.. but volume of users is too low"
  ([BetaNews](https://betanews.com/2017/10/09/windows-phone-really-is-dead)). Money could not buy an
  ecosystem without users.
- **Firefox OS.** Mozilla: "we failed to build the full ecosystem". It had only low-end devices and
  few hardware partners
  ([The Register](https://www.theregister.com/2015/12/11/mozilla_leaves_mobile_os_android_looks_invincible/)).
  It survived as the KaiOS fork, for feature phones.
- **webOS.** HP killed the TouchPad 49 days after launch
  ([PCWorld](https://www.pcworld.com/article/482026/hp_says_so_long_to_webos_devices.html)). The
  parent company lost commitment, and the technology lived on at LG.
- **BlackBerry 10 / Tizen.** BB10 tried to fill its app gap by running Android apps. Samsung moved its
  watches from Tizen to Wear OS in 2021 **[unverified: no primary source fetched]**.
- *Shared lesson:* timing, distribution and developer volume beat technical quality. For a newcomer,
  the way in is compatibility with the ecosystem that already exists.

## 7. Platform economics

- **Red Hat** earns from subscriptions (support, certification, long life cycles), not licences. Its
  CentOS Stream change ([CentOS blog, 2020](https://blog.centos.org/2020/12/future-is-centos-stream/))
  and its 2023 limit on RHEL source access
  ([Red Hat blog](https://www.redhat.com/en/blog/furthering-evolution-centos-stream)) led to
  Rocky Linux and AlmaLinux and a public backlash
  ([FOSSlife](https://www.fosslife.org/red-hats-source-code-policy-change-and-community-reactions)).
- **Canonical** charges hardware makers a fee per certified configuration per release and lists the
  certified machines publicly
  ([Ubuntu certification](https://certification.canonical.com/docs/programmes/desktop/Desktop_Programme_Guide/)).
  It also sells support and extended security maintenance (Ubuntu Pro)
  **[unverified: revenue split]**.
- **Raspberry Pi.** A trading subsidiary sells hardware and funds the charity, nearly US$50 million
  between 2012 and 2024. The subsidiary listed on the LSE in 2024
  ([Raspberry Pi Foundation](https://www.raspberrypi.org/blog/what-would-an-ipo-mean-for-the-raspberry-pi-foundation/),
  [Wikipedia](https://en.wikipedia.org/wiki/Raspberry_Pi_Holdings)). Hardware can pay for an open
  mission, but it took cheap hardware and huge volume.
- **App store cuts.** The 30% norm is under legal and regulatory pressure worldwide **[general
  knowledge]**. A new, small store has no leverage to charge one.

## 8. Healthcare-adjacent platforms

- **Epic App Orchard → Showroom / Connection Hub.** Developers criticised the fees, and Epic was
  reported to be cutting them by 33–80%
  ([Becker's](https://www.beckershospitalreview.com/ehrs/epic-to-lower-app-orchard-fees-4-notes.html)).
  The programme was later reorganised into Showroom and Connection Hub
  ([showroom.epic.com](https://showroom.epic.com)) **[unverified: exact dates and fee terms]**.
- **SMART on FHIR.** It became portable because regulation required it: US certified EHRs must offer
  a standardized FHIR API with SMART App Launch (45 CFR 170.315(g)(10)). Inferno is the public test
  kit ([ONC g10 test kit](https://github.com/onc-healthit/onc-certification-g10-test-kit)). The
  Conditions of Certification limit the fees vendors may charge for API access
  ([45 CFR 170.404](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-D/part-170/subpart-D/section-170.404)).
  The SMART App Gallery ([apps.smarthealthit.org](https://apps.smarthealthit.org)) shows that one app
  can work with many EHRs. *Lesson:* a public conformance test kit is what makes "works with" mean
  something.
- **Google Health (closed 2012).** Google said it was "not having the broad impact that we hoped"
  ([Google blog](https://googleblog.blogspot.com/2011/06/update-on-google-health-and-google.html)).
  Data export stayed open for a year after closure.
- **Microsoft HealthVault (closed November 2019).** Microsoft arranged migration partners before
  deleting data ([MedCity News](https://medcitynews.com/2019/04/microsoft-healthvault-is-officially-shutting-down-in-november/)).
  *Lesson:* consumer health records with no place in clinical work don't get used. A dignified exit
  path is part of being trustworthy.

---

## What MedBrains should do (mapped to RFC-HOSPITAL-OS)

### Keep

- **Technical-only kernel with the no-domain CI rule (§3a).** This is Linux's separation of mechanism
  from policy.
- **Debian base, never our own kernel (§8b).** Distributions win by packaging, not by re-inventing.
- **WASM / out-of-process extensions that never touch the database (§4, §8g).** This is the
  CrowdStrike lesson.
- **A/B updates, dm-verity, signed images (§8b, §8j, D4).** This is the ChromeOS model.
- **"Security features are never paid extras" and "no telemetry by default" (§8j).**
- **Standards first (§7), with SMART on FHIR and CDS Hooks as the extension surface.**

### Change

1. **Reorder phases so the standards ecosystem comes before our own.** Move C1 (SMART apps), C3 (FHIR
   write and search) and C4 (CDS Hooks) ahead of E1 (the bespoke extension protocol) and K6 (store).
   An app already built for Epic or Cerner over SMART should run on MedBrains first. That is the
   Windows Phone and Firefox OS lesson. Keep the bespoke protocol for what FHIR doesn't cover (flow
   blocks, device drivers).
2. **§8j "privacy labels"**: generate them from the grants the kernel enforces, never from text the
   developer writes. Re-check them on every extension update.
3. **§8e hardware kits as "the moat"**: switch from own kits only to a **certification programme**
   (Canonical- and Android-style) for partner hardware, plus a MedBrains reference kit. If kits are
   the only revenue, they compete with the integrators the ecosystem needs. Hardware worked for
   Raspberry Pi only at very large volume.
4. **§8g "community tier, unreviewed"**: keep the tier, but every listing still gets an automated
   scan and signature (notarisation-style). Unscanned code must not be installable outside developer
   mode.

### Add

1. **A written compatibility promise plus a compatibility test suite (CTS).** Version the kernel
   interface and extension protocol, support N-1 for a stated period (for example 24 months), and
   publish a CTS that partners, forks and hardware kits run. Tie the "MedBrains Compatible" trademark
   to passing it (Android CDD model). This becomes a phase before E2/K6.
2. **Release channels and staged rollout.** Add canary, beta and stable channels, percentage rollout
   with automatic halt on health regressions, hospital-set maintenance windows and deferrals, and
   the same staging for *extension* updates. A/B rollback alone is not enough. This extends D4.
3. **A published support lifecycle.** Dated LTS releases (security fixes for N years) and an
   end-of-support date for each certified hardware kit, as ChromeOS and Debian do.
4. **Grant hygiene.** Extension grants expire automatically when unused, are time-limited where
   possible, and are approved once by the hospital admin, never prompted to clinicians.
5. **Open-source and economics pledges, written now.** The core stays Apache-2.0 with no relicensing.
   No fee for API or FHIR access. Store and certification fees cover costs only. A trademark policy.
   A guaranteed full data export, as the Google Health and HealthVault exits did.
6. **Governance.** Named subsystem maintainers and a public RFC process. Consider a neutral foundation
   once partners invest, so they are not building on one company's goodwill **[judgement, not a
   sourced finding]**.

### Avoid

- A percentage cut on partner revenue or any toll on data access (Epic App Orchard).
- Paying developers to fill an app gap before there are users (Windows Phone).
- Running third-party code with kernel-level trust, even "certified" code (CrowdStrike).
- Prompting clinicians for security decisions (UAC).
- Changing the openness deal after partners have committed (Red Hat 2020/2023).
- A consumer-first PHR product disconnected from clinical work (Google Health, HealthVault).
- Promising support for tiers (§8c tiers 2–3) without a dated support window.
