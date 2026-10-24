# Google Calendar configuration

1. Create/select a Google Cloud project that you control.
2. Enable Google Calendar API.
3. Configure the OAuth consent screen, support contact and developer contact. While in testing, add only the intended test users.
4. Create an OAuth 2.0 client of type **Web application**.
5. Add the exact authorized JavaScript origins: `http://localhost:3000` for development and the HTTPS production origin for hosting. This browser token flow uses a popup and does not require an application redirect handler.
6. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` or as a build argument; rebuild. Never supply a client secret to the browser.
7. Open “היומן שלי” and press the connect button. Select an account and approve `https://www.googleapis.com/auth/calendar.freebusy`.

The token stays in memory. The app queries `POST https://www.googleapis.com/calendar/v3/freeBusy` for the primary calendar only, from now to 90 days ahead. No event titles, descriptions or calendar lists are fetched. A failed or denied query never turns missing data into “free”. Each candidate shows a private comparison and a separate button to publish that answer to the circle. Disconnect revokes the in-memory token and clears the private busy results. Already-published poll answers remain until changed or the circle is deleted. Refreshing the page clears the local token; reconnect through a user gesture.

Expired tokens, popup rejection, denied scopes and API failures have explicit UI states. OAuth verification/publishing requirements depend on Google's project configuration; complete the required review before public distribution. This repository does not create or modify Google Cloud resources.

Reference:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query

Acceptance check with a configured project: create a known busy event, propose an overlapping slot and one adjacent slot, verify conflict vs free, publish a single answer, verify only that answer changes in a second member's session, disconnect and confirm the private comparison disappears. Google end-to-end verification requires the operator's configured OAuth client and explicit consent.
