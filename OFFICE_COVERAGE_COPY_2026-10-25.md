# Office Coverage copy — 2026-10-25

Office client records now render the actual Arctos Coverage form. The previous implementation copied only category headers while retaining different Office editors; those editors have been removed from Coverage.

The generator bundles and executes the original Arctos client modules with synthetic, in-memory records. It captures the fully enhanced DOM, including Medicare.gov credentials, card managers, Medicare notes, old-plan fields, life-policy cards and custom-carrier controls, hospital-indemnity cards and document managers, retirement fields, and SOA dialogs. The generated assets include a source-file hash manifest. No real client information or credentials are used during generation.

The Arctos declarations, colors, media queries, and cascade are copied and bounded to Coverage. The form uses Arctos's 980px dialog width and 16px body inset. The permanent Office Save control remains visible while the form scrolls. Other Office pages keep their existing styles.

Office's agency bridges load and save the original Arctos field names through explicit mappings. Saves send changed fields, preserve historical/agency-specific fields outside the copied form, check row versions, retain row identities across retries, and preserve protected identifiers when a protected read fails. Saved rows and newly added rows use the original Arctos card templates.

The copied SOA dialogs run in Office rather than redirecting to an agency CRM. Signed uploads and private policy/card files stay in the selected agency's storage. File metadata is scoped to the client and policy, signed upload destinations are constrained, and retained SOAs cannot be removed through the file editor. SOA dates and retention are validated server-side. Platinum text links use the copied public signing page at `/platinum/soa-sign.html`, connected to Platinum's token-validated `soa-sign` endpoint. This avoids the pre-existing Platinum page's Arctos endpoint.

## Verification

- 61 focused Office client-record, permissions, file, signing and rendered-DOM checks pass.
- TypeScript check and JavaScript syntax checks pass.
- A full form-shape comparison checks every field, option, section and document control against the generated Arctos reference.
- Browser comparison with synthetic records confirms matching field dimensions, fonts, padding, borders and section colors. No production client records were changed by tests.
- Both deployed agency bridges reject unauthenticated requests with HTTP 401; the public signing endpoint rejects a missing signing token with HTTP 400.
- The wider repository's 68-test command has four pre-existing failures. An unchanged checkout reproduces the same four failures; they concern the separate main CRM's older Deceased, visual-layer, dashboard-import and SOA-import assertions.

Regenerate with `node scripts/copy-arctos-coverage.cjs ../arctos-opt` from a clean Arctos checkout with its dependencies installed. Run `npm run test:office-client` and `npm run typecheck`. The public deployment contains only runtime assets, not the synthetic visual-review pages or server source files.
