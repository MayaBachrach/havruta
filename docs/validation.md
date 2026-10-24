# Validation

Automated checks for this pilot:

- `npm test`: ranking without outsiders, explicit/unexpired same-place grouping, free/busy endpoint boundaries, ICS escaping/UTF-8 folding, token hashing, circle isolation, vote uniqueness, creator-only finalization, closed poll rejection, chat expiry/purge, invite rotation, membership revocation, transactional invalid-plan rejection, check-in expiry, private saved places, owner member removal, session expiry and deletion cascades.
- `npm run typecheck`: strict TypeScript across UI, API, store and tests.
- `npm run build`: production Next.js compilation and static/server route generation.
- `npm run test:smoke`: launches an isolated production server with a disposable SQLite database, creates two separate cookie sessions, joins by invitation, creates a plan, exchanges a shared message, rejects unauthenticated access and foreign Origin, enforces creator-only finalization, and deletes the test circle.

The Google consent/API flow cannot be validated end-to-end without an operator-owned configured OAuth client. See `google-calendar.md` for that acceptance test. Docker hosting and actual external calendar saves require deployment/user confirmation and are not implied by local build success.

Additional iteration: attendance responses are tested independently of time-poll votes, including pre-confirmation rejection, non-member rejection and removal cleanup. Managed production preview setup was added, but interactive visual verification remains incomplete because the cloud-browser route was unavailable. No browser QA pass is claimed.

Further checks cover idempotent replay/conflict handling and full guest-profile deletion with foreign-key cleanup. The agenda is a view of locally stored confirmed group plans, not a claim that the external Google calendar is synchronized. Shared reminders are drafts copied by the user; the application sends no unsolicited messages.

Persistence verification closes and reopens a real temporary SQLite file, checks the same identity/group remains available, and checks mode 0600. The HTTP smoke now additionally exercises idempotent plan creation, explicit attendance and self-profile deletion through the actual production API.

Coarse-location tests check client/server rounding, invalid coordinate rejection, expiry and the absence of transitive false grouping (A near B and B near C never implies all three are near each other). Browser permission UI remains unverified; location sharing is disabled in demo mode.
