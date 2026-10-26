# Office voicemail sync — 2026-10-25

The Office Phone page previously read office_phone_feed only. Its Refresh action did not contact RingCentral; new activity depended on visiting and syncing the separate M&M CRM. Live read-only checks found zero voicemail rows, 990 visible call rows, and a last call import on October 24 at 03:04 America/Chicago.

Office now uses an authenticated, bearer-session POST endpoint to run the existing office RingCentral importer directly. Opening Phone checks once per five minutes within the session; Refresh forces another check. Saved records render first and remain available on network errors. Voicemail permission/API warnings remain visible across phone filters. Signing out invalidates pending UI responses. Imports reuse existing keys, retain unknown callers, and preserve staff notes and deletion markers.

The original M&M sync delegates to the same importer, with agency-specific concurrent-request deduplication. The Arctos-only API and all phone routing, text delivery, account permissions, voicemail greetings and original RingCentral messages remain unchanged. No RingCentral secret is exposed to Office or diagnostic output.

Validation: 32 focused phone/import/access/DOM tests and 91 client-record regression tests pass. TypeScript, JavaScript syntax, and diff checks pass. A server-only diagnostic script can check the deployed credential scope and voicemail API status without outputting caller data or credentials. A signed-in production voicemail import still requires verification; an empty Office table alone does not establish whether RingCentral ReadMessages permission is missing.
