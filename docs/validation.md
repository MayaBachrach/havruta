# Validation

Automated checks for this pilot:

- `npm test`: ranking without outsiders, explicit/unexpired same-place grouping, free/busy endpoint boundaries, ICS escaping/UTF-8 folding, token hashing, circle isolation, vote uniqueness, creator-only finalization, closed poll rejection, chat expiry/purge, invite rotation, membership revocation, transactional invalid-plan rejection, check-in expiry, private saved places, owner member removal, session expiry and deletion cascades.
- `npm run typecheck`: strict TypeScript across UI, API, store and tests.
- `npm run build`: production Next.js compilation and static/server route generation.
- `npm run test:smoke`: launches an isolated production server with a disposable SQLite database, creates two separate cookie sessions, joins by invitation, creates a plan, exchanges a shared message, rejects unauthenticated access and foreign Origin, enforces creator-only finalization, and deletes the test circle.

The Google consent/API flow cannot be validated end-to-end without an operator-owned configured OAuth client. See `google-calendar.md` for that acceptance test. Docker hosting and actual external calendar saves require deployment/user confirmation and are not implied by local build success.
