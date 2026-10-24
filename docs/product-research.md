# Product direction · 24 October 2026

Research uses current first-party feature descriptions. The opportunities below are product hypotheses inferred from positioning, not independently measured competitor defects or claims that competitors lack undocumented features.

| Product | Documented strength | Opportunity for Havruta |
| --- | --- | --- |
| Partiful | Invitations, RSVP tracking, Find a Time with yes/no/maybe, comments and event coordination | Focus the home screen on recurring friend circles and lightweight spontaneous meetups rather than invitation production. Do not claim scheduling polls are unique. |
| Doodle | Shared time polls, responses, calendar coordination and finalized meeting invitations | Add an explicitly social layer: existing friendships, a meetup chat and optional place check-ins. Preserve clear, transparent voting. |
| Timeleft | Groups of new people, booked venues, event chat and follow-up connections | Serve existing friends with self-directed plans. Enable a quick coffee with people already nearby instead of depending on a booked group experience. |

Sources:
- https://help.partiful.com/en-us/articles/15525422-can-i-poll-or-survey-my-guests
- https://partiful.com/free-invitation-maker
- https://doodle.com/en/product/polls/
- https://timeleft.com/how-it-works/

## Shipped priorities

1. A real shared data model before adding decorative features. One person's vote cannot overwrite someone else's.
2. A short path: circle → proposal → votes → final time → calendar.
3. Temporary meetup chat to reduce the need for yet another permanent group.
4. Explicit, time-limited check-ins at a named place, or separately consented one-shot coarse-area sharing. Suggestions explain exactly why they appeared and require someone to create the plan. No background location assumptions; raw device coordinates are rounded before transmission.
5. Google free/busy as private decision support; individual answers are only shared after a click.
6. A warm Hebrew UI with real empty states, plus a labeled demo that does not pretend fictional friends are online.

## Next validation

Test with three friend circles for a week. Measure proposal-to-confirmation time, percent of proposals with all responses, confirmed-to-attended conversion (opt-in self-report), and whether check-ins create additional meetups. Ask whether seven-day proposals and 24-hour post-meeting chats feel right. Avoid optimizing for chat time; optimize for meetings that happen.

## Next engineering milestones

Recoverable accounts and device transfer; abuse reporting; opt-in notifications; calendar multiple-selection and revalidation before finalizing; monitoring of retention cleanup; shared Postgres for horizontal hosting; durable audit/operations without storing private message bodies in logs.
