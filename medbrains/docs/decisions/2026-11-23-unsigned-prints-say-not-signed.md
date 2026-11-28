---
date: 2026-11-23
title: A printed signature area never prints empty, and never a made-up handwriting
status: decided
area: print
---

## What

Wherever a signature area is printed it now holds one of three things: the signer's own image;
or, for a signature with no image, the words "Digitally signed by <name>, Reg. no. <no>,
<date>"; or "Not signed". This is the lab report (the server template `lab_report` and the web
print in `LabReportPrint.tsx`) and the web `PrintSignatureBlock`.

`PrintSignatureData` gains `signer_registration` (the signer's `mci_number`, else
`state_council_number`, from their doctor profile). `LabReportFullPrintData` loses
`pathologist_signature_url`, which was always empty: the signature comes from `signatures`.

`PrintSignatureBlock` no longer draws the signer's name in a script font when there is no
image, and its colours are theme tokens.

## Why

Blank paper under a pathologist's name reads as signed to whoever is handed the report. And a
name drawn in a script font is handwriting the system made up, which the owner ruled out
(2026-11-23): a signature is the signer's own, or it is words.

## Rejected

- Leaving the area blank for unsigned reports and relying on the "preliminary" status line:
  the status is at the top, the signature is where people look.
- Printing one line per signed result on a lab report: an order's results are signed one by
  one, so a 20-test report would carry 20 identical lines. One line per signer.
- Taking the registration number from the report's `pathologist_registration_number`: the
  signer is not always the named pathologist, and the number must be the signer's.
