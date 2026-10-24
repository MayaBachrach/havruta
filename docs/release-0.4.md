# 0.4 · Usability and reliability

- Personal “waiting for you” shortcuts to unanswered time polls and pending attendance.
- Search by meetup title/place/type with Hebrew-diacritic and whitespace normalization.
- Local tab-only proposal drafts, explicitly labeled as unshared, isolated by user and circle, removed after successful creation or explicit deletion.
- Storage-denied/quota-failure handling: optional storage no longer prevents app initialization.
- Cross-circle overlap warnings for confirmed plans; cancelled and explicitly declined plans are excluded, and adjacent end/start boundaries are permitted.
- Last-sync, saving and offline status; refreshes preserve action errors until dismissed or another action begins.
- Larger mobile targets, more readable secondary text, revised contrast colors and programmatically named native dialogs.
- Optional meetup notes and creator-only editing. Revision checks prevent one device silently overwriting another. Changing a confirmed venue clears attendance for reconfirmation and requires acknowledgment that external calendars do not update automatically.
- Cryptographic client ID fallback for preview environments without `crypto.randomUUID`; no fallback to non-cryptographic randomness.

Research and rationale: `docs/usability-research.md`.

Verification is split deliberately: pure/storage/API tests verify logic and access control; cloud-browser checks verify observed UI behavior. Browser checks use fictional demo data. Real Google consent, browser geolocation permission and external calendar saves require a configured HTTPS deployment and are not implied by local tests.

Additional interaction fixes: tab navigation resets scroll and moves keyboard focus to the page heading; direct meetup links still reveal the target card and respect reduced-motion preferences. New local times are round-trip validated, including nonexistent spring-forward times, rather than silently shifting a plan to a different hour.

Polling now uses identity-scoped entity tags. An unchanged authenticated snapshot returns an empty 304 response instead of retransmitting chats and plans; data is still marked `no-store` and no public/shared cache is introduced. Tests verify unchanged, changed and different-user behavior. This reduces transferred data for unchanged polls; it does not eliminate the server-side snapshot query or provide WebSocket delivery.
