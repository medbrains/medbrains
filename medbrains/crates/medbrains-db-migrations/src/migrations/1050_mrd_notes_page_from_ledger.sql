-- ====================================================================
-- Migration: 1050_mrd_notes_page_from_ledger.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The case-sheet packet's datewise notes page is the clinical-notes ledger
-- now (RFCs/RFC-MODULE-clinical-notes.md, phase 4): printing a visit's case
-- sheet files the PDF onto this page. Existing packets point at the old
-- consultation and progress-note tables; point them at the ledger.

UPDATE mrd_case_sheet_pages
   SET source_table = 'clinical_notes', page_title = 'Clinical notes, datewise'
 WHERE page_code IN ('opd-datewise-soap', 'ipd-datewise-soap')
   AND source_table <> 'clinical_notes';
