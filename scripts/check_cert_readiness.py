#!/usr/bin/env python3
"""Map MedBrains implementation evidence to certification readiness tracks.

This is a product-readiness check, not a certification claim. It intentionally
reports partial/gap states so the product team can harden modules before an
external ISO/SOC/HITRUST/medical-device audit.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


TOOLS_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_ROOT.parent / "medbrains"


@dataclass(frozen=True)
class Evidence:
    label: str
    path: str
    needles: tuple[str, ...] = ()


@dataclass(frozen=True)
class ReadinessCheck:
    area: str
    certificates: tuple[str, ...]
    modules: tuple[str, ...]
    min_evidence: int
    evidence: tuple[Evidence, ...]
    required_actions: tuple[str, ...]
    strict_blocking: bool = False


MODULE_GROUPS: tuple[tuple[str, str], ...] = (
    (
        "Clinical",
        "Patients, OPD, emergency, doctor workflows, chronic care, order sets, case sheets",
    ),
    (
        "Diagnostics",
        "Laboratory, radiology, blood bank, critical values, DICOM/LOINC evidence",
    ),
    (
        "Pharmacy",
        "Catalog, prescribing, dispensing, allergies, schedules, POS billing, FEFO/batches",
    ),
    (
        "Inpatient",
        "IPD, ICU, nursing, OT, MAR, vitals, discharge, diet kitchen, bedside portal",
    ),
    (
        "Finance",
        "Billing, insurance, Razorpay orders/webhooks/refunds, reconciliation, GST/TPA evidence",
    ),
    (
        "Operations",
        "Procurement, CSSD, housekeeping, BME, MRD, HR, security, facilities, printers",
    ),
    (
        "Compliance",
        "NABH/JCI evidence, consent, infection control, audit, regulatory reporting",
    ),
    (
        "Specialty",
        "Maternity, psychiatry, PMR, palliative, cath lab, endoscopy, specialty workflows",
    ),
    (
        "Admin and Infrastructure",
        "Auth, RBAC, tenant isolation, deployment, network, audit, backups, observability",
    ),
    (
        "Mobile/TV/Edge",
        "React Native mobile, Android TV displays, offline/sync, device and print integrations",
    ),
)


CHECKS: tuple[ReadinessCheck, ...] = (
    ReadinessCheck(
        area="Security management and tenant isolation",
        certificates=("ISO/IEC 27001:2022", "SOC 2 Type II", "HITRUST"),
        modules=("All modules", "Admin and Infrastructure"),
        min_evidence=8,
        evidence=(
            Evidence("RLS static checker", "../scripts/check_rls.py"),
            Evidence("authorization fail-closed checker", "../scripts/check_authz_posture.py"),
            Evidence("tenant leak checker", "../scripts/check_tenant_leak.py"),
            Evidence("runtime SQLx checker", "../scripts/check_runtime_sqlx.py"),
            Evidence("audit coverage checker", "../scripts/check_audit_coverage.py"),
            Evidence("tracing checker", "../scripts/check_tracing_spans.py"),
            Evidence("region pinning checker", "../scripts/check_region_pinning.py"),
            Evidence("egress allowlist checker", "../scripts/check_egress_allowlist.py"),
            Evidence("route audit middleware", "crates/medbrains-server/src/middleware/audit.rs"),
            Evidence("read-side access logging", "crates/medbrains-server/src/middleware/access_log.rs"),
            Evidence("security proxy", "crates/medbrains-proxy/src/config.rs"),
        ),
        required_actions=(
            "Create ISO 27001 ISMS documents: scope, asset inventory, risk register, SOA, incident plan, access review evidence.",
            "Create SOC 2 control matrix with owner, frequency, evidence source, and operating effectiveness samples.",
            "Add vendor risk, backup-restore drill, availability/SLO, vulnerability management, and change approval evidence.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="Privacy and health-data handling",
        certificates=("ISO/IEC 27701:2025", "HIPAA readiness", "HITRUST"),
        modules=("Clinical", "Diagnostics", "Inpatient", "Compliance", "Admin and Infrastructure"),
        min_evidence=6,
        evidence=(
            Evidence("privacy/security audit route", "crates/medbrains-server/src/routes/audit.rs"),
            Evidence("read-side access logging", "crates/medbrains-server/src/middleware/access_log.rs"),
            Evidence("consent routes", "crates/medbrains-server/src/routes/consent.rs"),
            Evidence("signed documents", "crates/medbrains-server/src/routes/signed_documents.rs"),
            Evidence("data masking/redaction plan", "docs/compliance/data-masking-redaction-control-plan.md", ("PRIV-MASK-001", "Pseudonymization")),
            Evidence("PHI egress boundary filter", "crates/medbrains-core/src/boundary_filter.rs", ("BlockUnknown", "Classification::Phi")),
            Evidence("region pinning checker", "../scripts/check_region_pinning.py"),
            Evidence("redaction/masking checker", "../scripts/check_redaction_masking.py"),
            Evidence("audit coverage checker", "../scripts/check_audit_coverage.py"),
            Evidence("document template/output types", "packages/types/src/index.ts", ("DocumentTemplate", "DocumentOutput")),
        ),
        required_actions=(
            "Add data inventory, purpose-of-processing register, retention/deletion policy, DPA/BAA templates, and privacy impact assessments.",
            "Add explicit mask/reveal field-access semantics, PDF/DICOM hard redaction, deterministic non-production masking, and pseudonymized analytics evidence.",
            "Add breach response evidence and patient access/amendment/export workflows for PHI/PII.",
            "Do not market as HIPAA certified; HIPAA is a compliance program, not an HHS product certificate.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="NABH/JCI patient-safety evidence",
        certificates=("NABH", "JCI", "IPSG evidence"),
        modules=("Clinical", "Diagnostics", "Pharmacy", "Inpatient", "Operations", "Compliance"),
        min_evidence=5,
        evidence=(
            Evidence("NABH evidence routes", "crates/medbrains-server/src/routes/nabh_evidence.rs"),
            Evidence("NABH indicator routes", "crates/medbrains-server/src/routes/nabh_indicators.rs"),
            Evidence("quality page", "apps/web/src/pages/quality.tsx"),
            Evidence("infection-control page", "apps/web/src/pages/infection-control.tsx"),
            Evidence("consent page", "apps/web/src/pages/consent.tsx"),
            Evidence("case-sheet document categories", "packages/types/src/index.ts", ("case_sheet_cover", "progress_note", "mar_chart")),
        ),
        required_actions=(
            "Map every case-sheet, MAR, consent, handoff, surgical safety, fall-risk, and infection-control event to NABH evidence.",
            "Add department checklist evidence export against ACMSRC_HMS_Evaluation_Checklists.docx.",
            "Add evidence completeness checks per module before marking a module accreditation-ready.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="ABDM and FHIR interoperability",
        certificates=("ABDM readiness", "HL7 FHIR R4", "India EHR interoperability"),
        modules=("Clinical", "Admin and Infrastructure", "Compliance"),
        min_evidence=5,
        evidence=(
            Evidence("ABHA sandbox/prod client", "crates/medbrains-abdm/src/abha.rs", ("ABDM_SANDBOX", "ABDM_PRODUCTION")),
            Evidence("ABDM route module", "crates/medbrains-server/src/routes/abdm/mod.rs"),
            Evidence("ABDM HFR routes", "crates/medbrains-server/src/routes/abdm/hfr.rs"),
            Evidence("ABDM HIP relay routes", "crates/medbrains-server/src/routes/abdm/hip_relay.rs"),
            Evidence("ABDM signature verifier", "crates/medbrains-server/src/routes/abdm/signature.rs"),
            Evidence("FHIR R4 routes", "crates/medbrains-server/src/routes/fhir.rs"),
            Evidence("frontend ABDM panel", "apps/web/src/components/Patient/AbhaLinkPanel.tsx"),
        ),
        required_actions=(
            "Expose backend ABHA sandbox endpoints for session, public certificate, login OTP, verify OTP, and profile linking.",
            "Add sandbox integration tests and evidence captures for HFR, HIP callback relay, consent artifact handling, and FHIR export.",
            "Add consent revocation and audit evidence for every ABDM exchange.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="Payments, POS, and card-data scope control",
        certificates=("SOC 2 Type II", "PCI scope reduction evidence", "VAPT"),
        modules=("Finance", "Pharmacy", "Operations"),
        min_evidence=4,
        evidence=(
            Evidence("Razorpay backend routes", "crates/medbrains-server/src/routes/payment_gateway.rs", ("Razorpay", "webhook")),
            Evidence("card logging static check", "../scripts/check_no_card_logging.py"),
            Evidence("payment transaction migration", "crates/medbrains-db/src/migrations/0099_pharmacy_phase2.sql", ("payment_gateway_transactions",)),
            Evidence("pharmacy POS types", "crates/medbrains-core/src/pharmacy_phase2.rs", ("Pos", "Sale")),
            Evidence("pharmacy POS page/service", "apps/web/src/pages/pharmacy.tsx"),
        ),
        required_actions=(
            "Add Razorpay test-key sandbox configuration evidence and webhook signature replay tests.",
            "Add POS mock-device test harness, receipt/printer simulation, settlement reconciliation, refunds, and void approval audit.",
            "Keep raw PAN/CVV out of the product; continue using gateway token/order references only.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="Printer, document, and case-sheet controls",
        certificates=("NABH", "SOC 2 Type II", "ISO/IEC 27001:2022"),
        modules=("Clinical", "Inpatient", "Operations", "Compliance"),
        min_evidence=3,
        evidence=(
            Evidence("document routes", "crates/medbrains-server/src/routes/documents.rs"),
            Evidence("signed document routes", "crates/medbrains-server/src/routes/signed_documents.rs"),
            Evidence("print/document types", "packages/types/src/index.ts", ("Printer", "PrintJob", "DocumentTemplate")),
            Evidence("print template settings", "apps/web/src/pages/admin/settings/PrintTemplateSettings.tsx"),
        ),
        required_actions=(
            "Implement printer registry and print-job lifecycle; current route stubs must become persistent audited flows.",
            "Add reprint reason, watermark, version, approver, and patient-identifier validation for case-sheet documents.",
            "Add print-device mock tests for local and network printers.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="Medical-device and SaMD claim control",
        certificates=(
            "ISO 13485:2016",
            "ISO 14971:2019",
            "IEC 62304:2006+A1:2015",
            "IEC 82304-1:2016",
            "IEC 62366-1",
            "IEC 81001-5-1",
            "FDA/CE/CDSCO pathway readiness",
        ),
        modules=("Clinical", "Diagnostics", "Inpatient", "AI-assisted workflows"),
        min_evidence=3,
        evidence=(
            Evidence("SaMD intended-use statement", "docs/compliance/samd-intended-use.md"),
            Evidence("medical software risk register", "docs/compliance/samd-risk-register.md"),
            Evidence("software safety lifecycle plan", "docs/compliance/software-safety-plan.md"),
            Evidence("clinical safety traceability", "docs/compliance/clinical-safety-traceability.md"),
            Evidence("usability validation plan", "docs/compliance/usability-validation-plan.md"),
        ),
        required_actions=(
            "Define intended use and explicitly gate clinical decision/diagnosis/monitoring claims before sales material or UI copy.",
            "Create risk-management file, hazard analysis, safety requirements, verification traceability, and cybersecurity SBOM evidence.",
            "Classify India CDSCO, US FDA, and EU MDR/IVDR pathways before any regulated medical-device claim.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="AI governance",
        certificates=("ISO/IEC 42001:2023", "SaMD AI risk controls"),
        modules=("Clinical AI", "Analytics", "Operational AI"),
        min_evidence=3,
        evidence=(
            Evidence("AI system inventory", "docs/compliance/ai-system-inventory.md"),
            Evidence("AI risk register", "docs/compliance/ai-risk-register.md"),
            Evidence("model evaluation plan", "docs/compliance/model-evaluation-plan.md"),
            Evidence("human override policy", "docs/compliance/human-override-policy.md"),
        ),
        required_actions=(
            "Inventory every AI feature with owner, intended use, inputs, outputs, model/version, and human-review requirement.",
            "Add model evaluation, bias/safety testing, prompt/version logging, override workflow, and incident review evidence.",
            "Do not position AI outputs as autonomous diagnosis or treatment until SaMD classification is complete.",
        ),
        strict_blocking=True,
    ),
    ReadinessCheck(
        area="VAPT and vulnerability management",
        certificates=("VAPT report", "ISO/IEC 27001:2022", "SOC 2 Type II", "HITRUST"),
        modules=("All modules", "Infrastructure"),
        min_evidence=3,
        evidence=(
            Evidence("VAPT report index", "docs/compliance/vapt-reports.md"),
            Evidence("dependency audit target", "Makefile", ("pnpm audit",)),
            Evidence("security incident routes", "crates/medbrains-server/src/routes/it_security.rs", ("incident", "cert")),
            Evidence("egress allowlist checker", "../scripts/check_egress_allowlist.py"),
        ),
        required_actions=(
            "Schedule external VAPT and store executive report, technical report, remediation plan, and retest evidence.",
            "Add recurring dependency/SBOM scans for Rust, Node, OS packages, container/AMI, and infrastructure.",
            "Add vulnerability SLA and exception approval workflow.",
        ),
        strict_blocking=True,
    ),
)


def resolve_path(path: str) -> Path:
    if path.startswith("../"):
        return (PROJECT_ROOT / path).resolve()
    return (PROJECT_ROOT / path).resolve()


def evidence_present(item: Evidence) -> bool:
    path = resolve_path(item.path)
    if not path.exists():
        return False
    if path.is_dir():
        return True
    if not item.needles:
        return True
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return all(needle in content for needle in item.needles)


def status_for(check: ReadinessCheck) -> tuple[str, list[Evidence], list[Evidence]]:
    present = [item for item in check.evidence if evidence_present(item)]
    missing = [item for item in check.evidence if not evidence_present(item)]
    if len(present) >= check.min_evidence:
        return "mapped", present, missing
    if present:
        return "partial", present, missing
    return "gap", present, missing


def markdown_list(values: tuple[str, ...] | list[str], limit: int | None = None) -> str:
    selected = list(values)
    if limit is not None:
        selected = selected[:limit]
    return "; ".join(selected) if selected else "-"


def print_report(strict: bool) -> int:
    print("# MedBrains Certification Readiness Static Map")
    print()
    print("This report maps repository evidence to the certification tracks requested by the product team.")
    print("It is not an auditor attestation and must not be used as a certification claim.")
    print()
    print("Status legend: mapped = enough repo evidence for this static check; partial = some controls exist; gap = no sufficient repo evidence.")
    print()
    print("## Module Coverage")
    print()
    print("| Module group | Scope checked |")
    print("| --- | --- |")
    for module, scope in MODULE_GROUPS:
        print(f"| {module} | {scope} |")
    print()
    print("## Certification Track Map")
    print()
    print("| Area | Certification tracks | Modules | Status | Evidence found | Next gaps |")
    print("| --- | --- | --- | --- | --- | --- |")

    strict_failures: list[ReadinessCheck] = []
    for check in CHECKS:
        status, present, missing = status_for(check)
        if strict and check.strict_blocking and status != "mapped":
            strict_failures.append(check)
        evidence_labels = [item.label for item in present]
        gap_labels = [item.label for item in missing[:3]]
        print(
            f"| {check.area} | {markdown_list(check.certificates)} | "
            f"{markdown_list(check.modules)} | {status} | "
            f"{markdown_list(evidence_labels, 4)} | {markdown_list(gap_labels, 3)} |"
        )

    print()
    print("## Required Product Work")
    print()
    for check in CHECKS:
        status, _, _ = status_for(check)
        print(f"### {check.area} ({status})")
        for action in check.required_actions:
            print(f"- {action}")
        print()

    if strict_failures:
        print("Strict mode failed. Blocking readiness gaps:")
        for check in strict_failures:
            print(f"- {check.area}")
        return 1
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail if any blocking certification track is not mapped.",
    )
    args = parser.parse_args(argv)
    if not PROJECT_ROOT.exists():
        print(f"Project root not found: {PROJECT_ROOT}", file=sys.stderr)
        return 2
    return print_report(strict=args.strict)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
