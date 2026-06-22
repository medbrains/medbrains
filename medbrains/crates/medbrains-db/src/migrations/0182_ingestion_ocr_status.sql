-- OCR status on ingestion items. extracted_text is filled by the OCR engine
-- (tesseract); ocr_status records the outcome so failures / unsupported files
-- are visible rather than silently empty.

ALTER TABLE public.document_ingestion_items
    ADD COLUMN IF NOT EXISTS ocr_status text;   -- null=not run | done | failed | unsupported | unavailable
