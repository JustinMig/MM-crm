# Office Medical and Notes & Files copy — 2026-10-25

Office client records now use the original Arctos Medical and Notes & Files forms, declarations, category headings, card templates, file hub, note-history controls and in-site document previews. The generator executes the actual source integrations with synthetic records and records their source hashes. Existing Overview and Coverage copies remain connected.

Medical supports individual, initially collapsed doctor and medication cards; the exact specialty options; both pharmacy name/location pairs; medication/pharmacy notes and uploads; and doctors-section notes. Original medication suggestions and dosage/manual-entry controls use the agency-authorized bridge. Suggested strengths and replacement manual inputs persist in the same medication record. Obsolete catalog requests are aborted. Saves send only changed fields, preserve row versions and historical fields, queue removals until Save, and retain draft values and new-record IDs across failures. A removal retry after a lost success response is safe and does not delete or audit twice.

Notes & Files uses the original searchable file hub and categories, signed in-site previews/downloads, titled saved notes, note history/removal, shared client notes, general file categories and uploads. File listing is scoped to the selected client and paginated up to the same 4,000-record bound as Arctos. Private storage paths remain on the server. Uploads retain their selected category, use signed destinations in the selected agency bucket, and retry with stable IDs. SOAs, compliance-locked files and files still under retention cannot be removed through the general editor. General notes stay synchronized with Overview. Each tab keeps Save Client visible while its form scrolls.

The Platinum clients table received one additive nullable text column, doctors_section_notes, through the recorded remote migration office_arctos_medical_doctors_section_notes. SQL: ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS doctors_section_notes text. The schema read confirmed the column. Existing rows, client data, RLS and permissions were not changed. Both agency bridges still authenticate Office sessions and authorize edits server-side. The deployed versions are Arctos v15 and Platinum v19.

## Verification

- 82 focused Office record, rendered-DOM, CRUD, note, file, permissions, upload-retry, signing and medication-search checks pass.
- TypeScript, JavaScript syntax and git whitespace checks pass.
- Browser comparison with synthetic records confirms matching field widths, fonts, padding, borders and colors for both tabs. The Save control remains visible.
- No production client records, notes, documents or signatures were created or changed by tests. Both deployed bridges reject anonymous file-index requests with HTTP 401.
- The wider repository retains the same four pre-existing test failures previously reproduced on an unchanged checkout. They concern the separate main application’s old Deceased, visual-layer, dashboard-import and SOA-import assertions.

Regenerate with node scripts/copy-arctos-medical-files.cjs ../arctos-opt. Validate with npm run test:office-client and npm run typecheck. Deploy only runtime assets; synthetic review pages and server source are excluded from the static production deployment.
