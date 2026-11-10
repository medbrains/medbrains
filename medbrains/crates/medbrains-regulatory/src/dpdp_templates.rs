//! Starting templates for the DPDP / CERT-In policy pack.
//!
//! Every template is a starting point drafted against the official text —
//! the Digital Personal Data Protection Act, 2023; the DPDP Rules, 2025
//! (G.S.R. 846(E), 13-11-2025, Gazette of India); and CERT-In Directions
//! No. 20(3)/2022-CERT-In of 28-04-2022 under s.70B(6) of the IT Act — and
//! must be reviewed with the hospital's counsel before it is approved. The
//! screen says so on every draft.
//!
//! `{{…}}` placeholders are filled when a draft is started: the hospital's
//! name and the officers set on the officers screen. Hindi and Tamil privacy
//! notices start from the reviewed translations in
//! `packages/privacy/dpdp-notice.json`; the other policies start in English
//! with a translation placeholder.

use serde::Serialize;

/// Bumped whenever a template's text changes; each draft records it.
pub const TEMPLATE_VERSION: &str = "2026-10";

pub const KINDS: [&str; 6] = [
    "privacy_notice",
    "retention_schedule",
    "breach_response_plan",
    "processor_policy",
    "children_data_policy",
    "confidentiality_undertaking",
];

pub const LANGUAGES: [&str; 3] = ["en", "hi", "ta"];

#[derive(Debug, Clone, Serialize)]
pub struct TemplateInfo {
    pub kind: &'static str,
    pub title: &'static str,
    pub legal_basis: &'static str,
}

pub const TEMPLATES: [TemplateInfo; 6] = [
    TemplateInfo {
        kind: "privacy_notice",
        title: "Privacy notice to patients",
        legal_basis: "DPDP Act 2023 s.5; DPDP Rules 2025 r.3, r.9, r.14",
    },
    TemplateInfo {
        kind: "retention_schedule",
        title: "Data retention schedule",
        legal_basis: "DPDP Act 2023 s.8(7); DPDP Rules 2025 r.6(1)(e), r.8(3); CERT-In Directions 2022 (iv)",
    },
    TemplateInfo {
        kind: "breach_response_plan",
        title: "Personal data breach and cyber incident response plan",
        legal_basis: "DPDP Act 2023 s.8(6); DPDP Rules 2025 r.7; CERT-In Directions 2022 (ii)-(iv)",
    },
    TemplateInfo {
        kind: "processor_policy",
        title: "Data processor and vendor policy",
        legal_basis: "DPDP Act 2023 s.8(2), s.8(5); DPDP Rules 2025 r.6(1)(f)",
    },
    TemplateInfo {
        kind: "children_data_policy",
        title: "Children's data and guardian consent policy",
        legal_basis: "DPDP Act 2023 s.2(f), s.9; DPDP Rules 2025 r.10, r.11, r.12 and Fourth Schedule Part A",
    },
    TemplateInfo {
        kind: "confidentiality_undertaking",
        title: "Staff confidentiality undertaking",
        legal_basis: "DPDP Act 2023 s.8(4)-(5); IT Act 2000 s.72A; NMC/MCI Professional Conduct Regulations 2002 reg. 2.2",
    },
];

/// The title of a kind's template.
#[must_use]
pub fn title(kind: &str) -> Option<&'static str> {
    TEMPLATES.iter().find(|t| t.kind == kind).map(|t| t.title)
}

const NOTICE_JSON: &str = include_str!("../../../packages/privacy/dpdp-notice.json");

const REVIEW: &str = "> **Template — review with counsel before approval.** Drafted against the \
DPDP Act 2023, DPDP Rules 2025 and CERT-In Directions 2022; it is not legal advice.\n\n";

const TRANSLATION_PENDING: &str = "\n\n> Translation pending: this text must be translated and \
reviewed by a native-speaking legal reader before it is published in this language.\n";

/// The privacy notice in `language`, from the reviewed translations.
fn privacy_notice(language: &str) -> String {
    let parsed: serde_json::Value = serde_json::from_str(NOTICE_JSON).unwrap_or_default();
    let lang = &parsed["languages"][language];
    let text = |k: &str| lang[k].as_str().unwrap_or_default().to_owned();
    let purposes = lang["purposes"]
        .as_object()
        .map(|o| {
            o.values()
                .filter_map(|v| v.as_str())
                .map(|v| format!("- {v}"))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    format!(
        "{REVIEW}# {{{{hospital}}}} — Privacy notice\n\n{}\n\n{}\n\n{purposes}\n\n{}\n\n\
         ## Contact\n\nGrievance officer: {{{{grievance_officer}}}}\n\n\
         Data Protection Officer: {{{{dpo}}}}\n\n\
         Grievances are answered within 90 days (DPDP Rules 2025, rule 14(3)). If you are not \
         satisfied with the answer you may complain to the Data Protection Board of India.\n",
        text("collected"),
        text("purposesIntro"),
        text("rights"),
    )
}

const RETENTION: &str = "# {{hospital}} — Data retention schedule

How long each kind of record is kept, the law that sets the period, and what happens at the end.
Where two laws apply, the longer period governs. State clinical-establishment rules may set longer
periods — confirm them for your state.

- **In-patient case records** — keep 3 years from the start of treatment. Basis: MCI (Professional Conduct, Etiquette and Ethics) Regulations 2002, reg. 1.3.1. At the end: Review; medico-legal and pending-litigation records are held until closure.
- **Medico-legal case records** — keep Until the case is closed and any appeal period ends. Basis: Records required as evidence (CrPC / BNSS) — confirm with counsel. At the end: Erase or archive on counsel's advice.
- **PC-PNDT records (Form F and related)** — keep 2 years. Basis: PC-PNDT Act 1994, s.29. At the end: Erase unless proceedings are pending.
- **Schedule H1 drug register** — keep 3 years. Basis: Drugs and Cosmetics Rules 1945 — confirm rule with counsel. At the end: Erase.
- **Bio-medical waste records** — keep 5 years. Basis: Bio-Medical Waste Management Rules 2016 — confirm rule with counsel. At the end: Erase.
- **Books of account and vouchers** — keep 8 years. Basis: Companies Act 2013, s.128(5). At the end: Erase.
- **GST records** — keep 72 months from the due date of the annual return. Basis: CGST Act 2017, s.36. At the end: Erase.
- **Logs of processing of personal data, and the personal data they concern** — keep At least 1 year from the processing. Basis: DPDP Rules 2025, r.6(1)(e) and r.8(3). At the end: Erase unless another law requires more.
- **ICT system logs** — keep Rolling 180 days, kept in India. Basis: CERT-In Directions 2022, direction (iv). At the end: Roll over.
- **Consent records (DPDP consent ledger)** — keep As long as processing continues, then as the logs above. Basis: DPDP Act 2023, s.6(10) (burden of proof of consent). At the end: Erase.

## Erasure

When a purpose is served and no law requires the record to be kept, the personal data is erased
(DPDP Act 2023, s.8(7)) and the hospital's processors are told to erase their copies. Medical records
the law requires the hospital to keep are not erased on request; the refusal states the law that
requires it.
";

const BREACH_PLAN: &str = "# {{hospital}} — Personal data breach and cyber incident response plan

## Who

- Incident commander / Data Protection Officer: {{dpo}}
- CERT-In point of contact: {{certin_poc}}
- Grievance officer (answers patients' questions): {{grievance_officer}}

## The clocks start when the incident is noticed

Record the time the incident was **noticed** in MedBrains (Security → Incidents, *noticed at*). The
deadlines below are counted from that time and shown on the breach clock.

- Report a reportable cyber incident to CERT-In (incident@cert-in.org.in, 1800-11-4949), in the Annexure I format — **Within 6 hours of noticing it**. Basis: CERT-In Directions 28-04-2022, direction (ii).
- Intimate the Data Protection Board of India: the nature, extent, timing, location and likely impact of a personal data breach — **Without delay**. Basis: DPDP Rules 2025, r.7(2)(a).
- Send the Board the detailed report: updated description, facts and reasons, mitigation, findings on who caused it, remedial measures, and the intimations sent to patients — **Within 72 hours of becoming aware (or longer if the Board allows in writing)**. Basis: DPDP Rules 2025, r.7(2)(b).
- Tell each affected patient, through their account or registered contact: what happened, the likely consequences for them, what the hospital is doing, what they can do, and whom to contact — **Without delay**. Basis: DPDP Rules 2025, r.7(1).
- Give CERT-In the logs it asks for — **When reporting, or when CERT-In directs**. Basis: CERT-In Directions 2022, direction (iv).

## Steps

1. Contain: isolate affected systems and accounts; keep, do not wipe, the evidence and logs.
2. Assess: is it a cyber incident in CERT-In Annexure I? Is personal data affected? Mark both on the
   incident so the right clocks run.
3. Report and notify within the deadlines above, and record each filing (time and reference) on the
   incident.
4. Remediate and record the root cause and the measures that prevent recurrence.
5. Review within 30 days: what worked, what did not, and changes to this plan.

## Drills

Rehearse this plan at least once a year (tabletop or live) and record each drill in MedBrains
(Privacy compliance → Drills). An untested plan shows as a gap on the compliance dashboard.
";

const PROCESSOR_POLICY: &str = "# {{hospital}} — Data processor and vendor policy

A data processor processes personal data on the hospital's behalf: cloud hosting, laboratory
reference partners, billing and TPA software, SMS and messaging providers, transcription, IT support.
The hospital remains responsible for what they do (DPDP Act 2023, s.8(1)).

## Before a processor receives personal data

1. A valid contract is signed (DPDP Act 2023, s.8(2)) that requires the processor to:
   - process only on the hospital's documented instructions and only for the stated purpose;
   - take reasonable security safeguards — encryption or masking, access control, logging and
     monitoring, backups and continuity (DPDP Rules 2025, r.6(1)(a)-(d), (f));
   - keep logs of processing for at least one year (r.6(1)(e), r.8(3));
   - tell the hospital of any personal data breach immediately, so the hospital can meet its 6-hour
     (CERT-In) and 72-hour (Board) deadlines;
   - erase the data when the purpose is served or the contract ends, and confirm it in writing;
   - use sub-processors only with the hospital's approval, on the same terms.
2. The processor is entered in the register (Audit → Data processors): name, service, data
   categories, country, the contract reference, signed and expiry dates.
3. Transfers outside India meet any restriction the Central Government notifies (DPDP Rules 2025,
   r.15).

## Review

Review the register every year; a processor whose contract has expired receives no new data until it is
renewed.
";

const CHILDREN_POLICY: &str = "# {{hospital}} — Children's data and guardian consent policy

A child is anyone under 18 (DPDP Act 2023, s.2(f)).

## Care does not wait for consent

A clinical establishment processing a child's data **to the extent necessary to provide health
services to the child and protect her health** is exempt from the verifiable parental consent
requirement and from the bar on tracking (DPDP Act 2023, s.9(1) and (3); DPDP Rules 2025, r.12 and
Fourth Schedule, Part A, item 1). Treatment, records and the reports the law requires go ahead.

## Everything else needs a parent's verifiable consent

For any other purpose — research, reminders and outreach, photographs for publicity, sharing beyond
care — the hospital obtains the **verifiable consent of a parent or lawful guardian** before
processing (DPDP Act 2023, s.9(1); DPDP Rules 2025, r.10):

- check that the person consenting is an adult and is the child's parent or guardian, using identity
  and age details the hospital already holds or that the parent provides (r.10(1));
- record the consent in the consent ledger against the child's record, with who gave it.

For a person with a disability who has a lawful guardian, the guardian's verifiable consent is
obtained after checking the guardianship order (DPDP Rules 2025, r.11).

## Never

No tracking, behavioural monitoring or targeted advertising directed at children, and no processing
likely to harm a child's well-being (DPDP Act 2023, s.9(2)-(3)).
";

const UNDERTAKING: &str = "# {{hospital}} — Staff confidentiality undertaking

I, ______________________ (name), employee / contractor ID ______________, working as
______________________, undertake that:

1. I will keep confidential all information about patients, their families and staff that I see or
   learn in my work, during and after my engagement (NMC/MCI Professional Conduct Regulations 2002,
   reg. 2.2).
2. I will look at a patient's record only when my work needs it, and only as much as it needs. I
   understand that every access is logged and reviewed.
3. I will not copy, photograph, forward or remove personal data, including to personal phones,
   messaging apps or email, except as my role and the hospital's procedures allow.
4. I will report any suspected loss, misuse or unauthorised access to the Data Protection Officer
   ({{dpo}}) immediately, so the hospital can meet its 6-hour CERT-In and 72-hour Data Protection
   Board deadlines.
5. I understand that disclosing personal information in breach of a lawful contract may be an
   offence under s.72A of the Information Technology Act 2000, and that breaching this undertaking may
   lead to disciplinary action.

Signature: __________________  Date: ____________

Witness (HR): __________________
";

/// The template body for `kind` in `language`, with placeholders unfilled.
#[must_use]
pub fn body(kind: &str, language: &str) -> Option<String> {
    let base = match kind {
        "privacy_notice" => return Some(privacy_notice(language)),
        "retention_schedule" => RETENTION,
        "breach_response_plan" => BREACH_PLAN,
        "processor_policy" => PROCESSOR_POLICY,
        "children_data_policy" => CHILDREN_POLICY,
        "confidentiality_undertaking" => UNDERTAKING,
        _ => return None,
    };
    let pending = if language == "en" {
        ""
    } else {
        TRANSLATION_PENDING
    };
    Some(format!("{REVIEW}{base}{pending}"))
}

/// What a draft must no longer contain before it is approved: the template's
/// review note (removed once counsel has reviewed it) and any placeholder
/// still waiting for a value.
#[must_use]
pub fn unfinished(body: &str) -> Option<&'static str> {
    if body.contains("review with counsel before approval") {
        Some("Remove the template's review note once counsel has reviewed the text")
    } else if body.contains("— not set yet]") || body.contains("{{") {
        Some("Fill in every placeholder still marked “not set yet”")
    } else {
        None
    }
}

/// Fill the `{{…}}` placeholders. A value not set yet is left visibly blank.
#[must_use]
pub fn fill(text: &str, values: &[(&str, Option<String>)]) -> String {
    values.iter().fold(text.to_owned(), |acc, (key, value)| {
        let shown = value
            .clone()
            .unwrap_or_else(|| format!("[{key} — not set yet]"));
        acc.replace(&format!("{{{{{key}}}}}"), &shown)
    })
}

#[cfg(test)]
mod tests {
    use super::{KINDS, LANGUAGES, body, fill};

    #[test]
    fn every_kind_has_a_template_in_every_language_marked_for_counsel() {
        for kind in KINDS {
            for lang in LANGUAGES {
                let b = body(kind, lang).expect("template");
                assert!(b.contains("review with counsel"), "{kind}/{lang}");
                assert!(b.len() > 200, "{kind}/{lang}");
            }
        }
        assert!(body("unknown", "en").is_none());
    }

    #[test]
    fn the_privacy_notice_uses_the_reviewed_translations() {
        assert!(body("privacy_notice", "hi").expect("hi").contains("अस्पताल"));
        assert!(
            body("privacy_notice", "ta")
                .expect("ta")
                .contains("மருத்துவமனை")
        );
        assert!(
            !body("privacy_notice", "hi")
                .expect("hi")
                .contains("Translation pending")
        );
        assert!(
            body("retention_schedule", "ta")
                .expect("ta")
                .contains("Translation pending")
        );
    }

    #[test]
    fn the_breach_plan_states_the_statutory_clocks() {
        let b = body("breach_response_plan", "en").expect("plan");
        assert!(b.contains("6 hours") && b.contains("72 hours") && b.contains("r.7(1)"));
    }

    #[test]
    fn a_template_is_unfinished_until_reviewed_and_filled() {
        let fresh = fill(&body("breach_response_plan", "en").expect("plan"), &[]);
        assert!(super::unfinished(&fresh).is_some());
        assert!(
            super::unfinished("# Plan\n\nReviewed text with every contact filled in.").is_none()
        );
        assert!(super::unfinished("Contact: [dpo — not set yet]").is_some());
    }

    #[test]
    fn placeholders_are_filled_or_shown_as_missing() {
        let out = fill(
            "{{hospital}} / {{dpo}}",
            &[("hospital", Some("City Hospital".into())), ("dpo", None)],
        );
        assert_eq!(out, "City Hospital / [dpo — not set yet]");
    }
}
