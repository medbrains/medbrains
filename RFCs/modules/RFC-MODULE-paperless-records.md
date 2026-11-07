# RFC: Paperless records, the starting product

Status: DRAFT, 2026-11-07. Owner decision: this is the first product we sell.

## 1. The problem and the product

Hospitals that have electronic records still print, for four reasons:

1. **Doctor signatures.** Legal e-signatures are too slow for forty notes a day, so the doctor signs printouts in ink.
2. **Outsiders do not trust a screen.** Courts, insurers (TPAs), police (MLC) and other hospitals ask for a signed, stamped copy, so the MRD prints one.
3. **Patients sign on paper.** Consent forms and refusals (DAMA/LAMA) are signed in ink, then scanned or filed.
4. **Transfers.** Case sheets go to another hospital as photocopies.

**The product is a paperless-records brick that a hospital adds next to the HMS it already runs.** It needs no switch. It connects to the other system through FHIR and HL7, and solves all four reasons. Hospitals do not move for a lower price; they move for a costly problem plus a deadline (DPDP in full from 13 May 2027). We land with this brick, then grow brick by brick.

**Hard requirement:** the brick works on its own, beside another vendor's HMS. Anything that needs our full HMS is a later phase.

## 2. What exists in India (checked 2026-11-07, vendor pages only)

| Piece | Who | Gap |
|---|---|---|
| A paperless bedside layer that works "alongside" the existing HMS | Caresoft **Digital IPD**: Android tablets, rollout in "ten days", offline, nursing notes, orders, consent "captured on-device with a signature", "built to meet" NABH and DPDP | No doctor legal signature, no MRD, no court or insurer copy, no transfer, no NMC. Its success story names no hospital and gives no measured results |
| A tablet IPD | PurpleIPD: NABH-ready, ABDM-certified | No signing standard stated |
| Aadhaar eSign for hospitals | eMudhra emSigner, integrated into one hospital chain's system for consent and TPA pre-authorisation | A separate product, bolted on |
| ABDM transfer | Many ABDM-certified HMS | Signatures are not verifiable by the receiver |
| Outsider verification (a QR that proves the record is unchanged) | **Not found**, in India or at Epic or Oracle | Open |

Caresoft already sells "beside your HMS" for the ward, so the land strategy is proven. **Our difference is what they do not have:** legal doctor signatures that follow the NMC advisory, a sealed MRD, outsider verification, a court certificate and verified transfer.

## 3. The rules

The strength column says how sure we are. "Lawyer" marks what must be checked before we claim it in sales.

| Rule | What it requires of us | Strength |
|---|---|---|
| **NMC advisory, 13 Oct 2026** (Ethics and Medical Registration Board; read in two news reports, official text not yet found) | <ul><li>Doctors may authenticate electronic clinical documents remotely, "using recognised digital or electronic signatures".</li><li>A doctor signs only after reviewing the clinical information, and only for facilities they are appointed, empanelled, contracted or associated with.</li><li>Credentials "must remain under the control of the concerned doctor and must not be shared, delegated or transferred".</li><li>Suspected misuse is reported.</li><li>Facilities keep audit trails, authentication logs and time stamps.</li><li>Liability is unchanged.</li></ul> | medium: news reports only. Get the official text |
| **IT Act 2000** | Electronic records and electronic signatures are legal. Aadhaar eSign and DSC are notified methods | strong |
| **BSA 2023 s.63** (formerly Evidence Act 65B) | Electronic records are admissible with a certificate | strong. Lawyer: certificate format |
| **DPDP Act 2023 and Rules 2025** | <ul><li>Consent with plain notice, one per purpose, and withdrawable.</li><li>Consent managers allowed from 13 Nov 2026.</li><li>Security safeguards, logs, breach reporting to the Data Protection Board, children's data: in full from 13 May 2027.</li><li>Erasure yields to laws that require records to be kept.</li></ul> | strong on dates. Lawyer: health data, children, the retention interplay |
| **Aadhaar Act** | Never store the Aadhaar number. The eSign provider's hosted page handles it; we keep only the signed result and certificate | strong. Also fixes our unsalted Aadhaar hash finding |
| **Aadhaar eSign API** | eSign 3.0 signs up to 5 document hashes per transaction; 2.1 signed one | medium: secondary source. Get the C-DAC/CCA spec |
| **NABH** | Each entry identifies its author and is dated, timed and protected from tampering; electronic authentication is allowed under a written policy | medium: inferred from JCI and CMS. Get the NABH text |
| **MCI 2002 regulations and court practice** | Keep in-patient records at least 3 years; keep MLC records permanently | medium. Lawyer |
| **Delhi HC, 22 Nov 2024** (Dr Rohit Jain's plea) | It asked for central rules against scanned or fake signatures, shared logins, and signatures used after a doctor leaves. The court sent it to the governments; no outcome is known | strong that the problem is recognised |
| **Mental Healthcare Act 2017, HIV records** | Restricted by default, including inside a transfer, unless the patient consents specifically | strong |

## 4. The design: five parts

### 4.1 Everyday entries (notes, orders, prescriptions)
- **Each doctor has their own signing key, held on their own hardware.** That can be an NFC badge card or FIDO2 key that is also a passkey (through Kanidm), or a phone passkey as a backup. Signing is a tap plus a PIN, about 2 seconds.
- **The server can no longer sign as a doctor.** Today `medbrains-signing` keeps each doctor's Ed25519 key on the server, wrapped with a server key (`doctor_signature_credentials.encrypted_private_key`). Anyone with server access could sign as any doctor, which conflicts with the NMC custody rule. Two ways to fix it:
  - **(a)** The doctor's hardware does the signing: WebAuthn assertions over the entry's hash.
  - **(b)** The doctor's key is wrapped by a secret only their hardware can produce (WebAuthn PRF), so the server cannot unwrap it alone.

  Pick one by test (§7).
- **A seal is a hash chain per patient record.** Each sealed entry carries the previous seal's hash. A change is a new amendment entry, never an overwrite. The original stays visible.
- **The "review first" rule is enforced on screen.** The sign button needs the document and its investigations opened first, and the seal records the review.
- **Signers are bound to their facility.** A doctor can seal only for the facilities their role assignment lists.

### 4.2 Documents that leave the hospital
These are discharge summaries, death and medical certificates, and MLC reports.
- **Legal signatures behind one interface.** Remote DSC by default, then USB DSC and Aadhaar eSign, all behind one provider-neutral trait with a capability map (the payments pattern).
- **End-of-shift batch signing.** One approval per 5 documents on eSign 3.0, or per provider limit.
- **Keys stay with the provider.** Remote DSC keys live in the certifying authority's HSM, under the doctor's PIN or OTP.

### 4.3 Patients
- **Ways to sign:** Aadhaar eSign by OTP; Aadhaar fingerprint at the counter through a certified RD-service reader, for patients who cannot write; or a tablet signature plus an OTP to the patient's phone plus a photo.
- **Show capacity, information and no duress, not just a signature.** Record:
  - the language of the notice;
  - who explained it, and that the explanation was read back;
  - a witness for high-risk procedures;
  - the patient's capacity, or the representative and why.
- **DPDP purposes:** treatment, insurance, research and sharing, each a separate tick, each withdrawable. Accept registered consent managers.
- **Keep the evidence to a minimum:** encrypted, with retention tied to the record.

### 4.4 Outsider trust
- **A QR verify link on every printout and PDF.** The public page shows only the document type, signer, time and "unchanged: yes or no", so no health data is shown. The full document needs an access link from the hospital.
- **A one-click court certificate** (BSA s.63), generated from the seal chain and audit log, signed by the MRD custodian.
- **Insurers and TPAs** receive signed documents directly, and verify them the same way.

### 4.5 Transfer to another hospital
- **Standard bundles.** FHIR R4 bundles in the NRCeS profiles (OP consultation, discharge summary, diagnostic report, prescription, ...). Each document keeps its seal and signature.
- **Three routes:**
  - ABDM HIE-CM, using the patient's consent artefact;
  - the patient carries a signed PDF with the FHIR data embedded and a QR;
  - a direct referral transfer to a partner hospital.
- **The receiver imports it read-only,** marked "from Hospital X, signed by Dr Y on date", and never mixes it into its own notes.
- **Consent limits what goes.** DPDP: only what the patient agreed to, for that purpose and that recipient. The medical-emergency legitimate use is logged. MHCA and HIV records stay restricted. MLC custody stays with the first hospital.

## 5. What exists in our code

| Piece | Where | State |
|---|---|---|
| Ed25519 sign and verify over canonical JSON | `crates/medbrains-signing` | built; **keys on the server** (fix in 4.1) |
| Signed-document projection for prints | `medbrains-signing::signed_documents`, used by print-data (clinical, billing, medicolegal) and documents | built |
| Password confirmation before a sensitive action | `medbrains-server-core::step_up` (`step_up_required`) | built; used on prescriptions |
| Case sheet ledger, MRD custodian, MRD (27 routes) | `medbrains-clinical-notes`, `medbrains-mrd` | built |
| Consent | `medbrains-consent` | crate exists; check its scope |
| ABDM HIP/HIU, FHIR bundles, ABHA | `medbrains-abdm` (epic #4829) | built; not on production |
| Passkeys | Kanidm 1.12 | supported; "Add passkey" is hidden in our restyle, and must be turned back on |
| Audit log, row-level security, disk encryption | platform and OS | built |

## 6. Permissions (defined in Rust first)

| Permission | Who |
|---|---|
| `records.entry.seal` | sign an entry with one's own key: doctors, nurses for nursing notes |
| `records.document.legal_sign` | apply a legal signature to an outgoing document: doctors |
| `records.consent.capture` | take a patient's consent: front desk, nurses, doctors |
| `records.verify.certificate.issue` | issue a court certificate: the MRD custodian |
| `records.transfer.send` / `records.transfer.receive` | send or import a case sheet: the MRD, doctors |
| `records.signing_key.revoke` | revoke a lost badge: IT |

The verify page is public but shows no health data. The full document always needs the reader's own permission.

## 7. Scenarios (acceptance criteria)

1. **Given** a doctor with a badge, **when** they sign a progress note, **then** the note is sealed with their key and chained to the previous seal; editing it later creates an amendment, and the original stays visible.
2. **Given** the server's database and key files are copied by an attacker, **when** they try to sign as a doctor, **then** they cannot, because the key or its unwrap needs the doctor's hardware.
3. **Given** a doctor who has not opened the investigations, **when** they press sign on a discharge summary, **then** signing is refused, with "Review the results first".
4. **Given** a doctor not associated with Facility B, **when** they try to seal a record of Facility B, **then** it is refused and logged.
5. **Given** a lost badge, **when** IT revokes it, **then** it signs nothing from that moment, and everything it signed before still verifies, with "key revoked on date" shown.
6. **Given** 12 discharge summaries at the end of a shift, **when** the doctor batch-signs with remote DSC, **then** all 12 carry a legal signature, with one approval per provider batch limit.
7. **Given** a patient who cannot write, **when** they consent with an Aadhaar fingerprint, **then** the consent holds the eSign result and no Aadhaar number is stored anywhere.
8. **Given** a TPA officer with a printed discharge summary, **when** they scan its QR, **then** they see the signer, time and "unchanged", and no diagnosis or patient name.
9. **Given** one character changed in a sealed record in the database, **when** anyone verifies it, **then** it shows "changed", with the seal that no longer matches.
10. **Given** a court request, **when** the MRD custodian issues a certificate, **then** a s.63 certificate is produced from the seal chain and audit log, and its issue is logged.
11. **Given** a patient who consented to share only the discharge summary with Hospital B, **when** Hospital B pulls the case sheet, **then** only that document is sent, and the patient can see that it was.
12. **Given** a transfer that includes a psychiatric note without specific consent, **when** it is sent, **then** the note is withheld, and the receiver sees that a restricted record exists.
13. **Given** a received case sheet, **when** Hospital B opens it, **then** it shows read-only, with the sender, the signers and verification, and cannot be edited.
14. **Given** the other vendor's HMS sends a discharge summary over HL7 or FHIR, **when** it arrives, **then** our brick seals and signs it, with no other MedBrains module installed.

## 8. Order of work

1. **Read the official texts:** the NMC advisory, NABH chapter text, the C-DAC/CCA eSign 3.0 spec, MCI retention and DPDP for health data. Get a lawyer's read of the claims marked above. No sales claim before this.
2. **Move keys to the doctor's hardware** (4.1, scenarios 1–5): test WebAuthn signing against PRF wrap, on the NFC badge and the OS screens.
3. **The verify page and court certificate** (4.4, scenarios 8–10).
4. **Patient consent** (4.3, scenario 7, plus DPDP purposes).
5. **The standalone connector:** HL7 and FHIR in from another HMS (scenario 14). This is what makes it sellable.
6. **Transfer** (4.5, scenarios 11–13), reusing the ABDM work.
7. **Legal signing through providers** (4.2, scenario 6). This needs a provider agreement, which is the owner's call.

## 9. Open questions for the owner

1. Which remote DSC or eSign provider to approach first, which is a commercial call.
2. Who gives the legal opinion.
3. The hardware for tests: one NFC reader and two FIDO2 badge cards (models to be proposed).
4. Pricing, and the first hospital to try it.
