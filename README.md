# חברותא · Havruta

A Hebrew-first app for existing friends to turn “we should meet” into a plan. Built with Next.js App Router, React, TypeScript and persistent SQLite. Includes a clearly separated interactive demo and real, server-backed group collaboration.

## Run locally

Requires **Node 22.18+** (Node 24 also works).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Create a guest profile, create a circle, copy its invite from “החברותות שלי”, and open the link in a separate browser profile to join as a second person. Same-browser tabs intentionally share one identity. No external services are needed for groups, polls, chat, or check-ins.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Working features

- Hebrew RTL dashboard, responsive mobile navigation, light/dark themes, empty/error/loading states.
- Named guest identities via HttpOnly cookies. Session tokens are hashed in storage.
- Private circles, high-entropy invitation links, owner-only invite rotation and deletion, member departure.
- One to five proposed times, per-member yes/maybe/no votes, response progress, missing-voter names and deterministic recommendations. Only the creator can finalize or cancel.
- Server-backed chat per meetup, refreshed every five seconds while the tab is visible. Closes 24 hours after the chosen slot ends; unconfirmed plans close after seven days. Cancellation clears messages immediately. Expired messages are purged on the next authenticated snapshot request, not by a scheduled job. SQLite backups may retain old pages/messages until their retention period ends.
- Personal saved places, owner member removal and invitation rotation.
- Explicit one-hour check-ins scoped to one circle. Matching place labels create a spontaneous meetup suggestion once at least two members check in. No GPS, location inference, background collection, or automatic invitations.
- Add confirmed plans to Google Calendar with a prefilled form; ICS export for Apple/Outlook. These require the user to save the event. Changes/cancellations are not synchronized back to external calendars.
- Optional Google OAuth free/busy lookup. Busy intervals and OAuth tokens stay in browser memory. Users explicitly publish individual poll answers; no automatic availability sharing. Primary calendar only, user-triggered refresh, no background sync.

## Google Calendar setup

See [docs/google-calendar.md](docs/google-calendar.md). Connection is visibly unavailable until the operator provides `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. The public client ID is configuration, not a secret; it belongs in environment configuration, never in a product form. No Google client secret is needed for this browser token flow.

## Hosting

This application requires a **Node server and durable local disk**. Do not deploy this SQLite version to ephemeral serverless instances or run multiple independent replicas. Use a single container/VM with a persistent volume, HTTPS reverse proxy, and backups. No hosting has been provisioned by committing this code.

```sh
docker compose up --build -d
```

The compose file binds to loopback. Put an HTTPS reverse proxy in front, set `APP_ORIGIN` to the external HTTPS origin and rebuild with the correct Google client ID. Production session cookies are Secure; browser use over plain HTTP will not retain the session. A local production smoke test can use an HTTPS proxy, or run `npm run dev` for HTTP development. Docker was not required for local development.

The proxy must overwrite `X-Forwarded-For` rather than trust client-provided values. Registration throttling uses that header; deploy edge rate limits too. The application also checks Origin for writes, validates membership on every action, uses prepared statements, and caps payloads, group size, plan creation and messages. Back up the complete SQLite database with its online backup API or stop writes first; do not copy only the main file during WAL writes. Run as the unprivileged container user and protect volume access.

## Trial limitations

This is a deployable **pilot**, not a launch-ready social network. Guest identity lasts 30 days in one browser and has no recovery or device transfer. Clearing cookies loses access; names are self-asserted, not verified. Invitation holders can join and see active circle content. Anyone who has already joined remains a member after invite rotation. Chat is not end-to-end encrypted. There are no push notifications, moderation/reporting, automated reminders, verified accounts, or precise location detection yet. The archive shows the most recent 50 plans per circle. Demo data is fictional and never saved to the server.

Before broad public release: add recoverable authentication, abuse reporting, consent and retention controls, managed database migrations/backups and observability. For multi-instance hosting, replace the SQLite store with shared Postgres and implement push/WebSocket delivery.

## Project map

- `src/components/havruta.tsx`: dashboard and collaboration UI
- `src/components/google-calendar.tsx`: optional Google consent/free-busy flow
- `src/app/api/havruta/route.ts`: same-origin authenticated API
- `src/lib/store.ts`: schema, membership checks and transactional actions
- `src/lib/planning.ts`: ranking, check-in matching and calendar exports
- `tests/`: authorization, lifecycle and planning regression tests
- `docs/product-research.md`: competitor findings and product choices

Original HTML prototype has been rebuilt as React components. Its two duplicated Google scripts, including an inline script inside an external script tag, were replaced with one typed integration.
