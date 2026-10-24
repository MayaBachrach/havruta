# Research-led usability iteration · 24 October 2026

This pass improves completing a meetup rather than increasing the number of features. These are design hypotheses to validate with people, not a claim of measured conversion improvement or certified accessibility compliance.

## Findings and implementations

| Principle | App problem | Implemented response |
| --- | --- | --- |
| NN/g: make system status visible | Refreshes and mutations were difficult to distinguish from stale state | A persistent last-sync / saving / offline status; failed forms retain inputs; background refresh no longer silently dismisses a mutation error |
| NN/g: prevent errors and support recovery | Closing a proposal or hitting storage restrictions could lose work or block startup | Per-user/per-circle temporary tab drafts, draft deletion, robust storage helpers and validation of restored drafts |
| NN/g: recognition over recall | People had to remember which circle needed a response | A home-screen “waiting for you” list distinguishing time votes from explicit attendance |
| NN/g: help users avoid mistakes | A new proposal could overlap a confirmed plan in another circle | Informational end-exclusive overlap checks, excluding cancelled and explicitly declined plans; never presented as a full Google calendar check |
| W3C: make pointer targets usable | Several links and voting controls were small on mobile | Larger targets, including 44px mobile controls, and more readable secondary text |
| W3C: label modal dialogs and preserve keyboard focus | Dialogs had a visual heading without a programmatic name | Native HTML dialogs with `aria-labelledby`, a close button, Escape handling and focus restoration |

Search additionally handles Hebrew diacritics and repeated spaces, and explains its selected-circle scope. Secondary-text and badge colors were adjusted using computed contrast ratios. This is not an exhaustive audit of every state, viewport or assistive technology.

## First-party references

- Nielsen Norman Group, *10 Usability Heuristics for User Interface Design*: https://www.nngroup.com/articles/ten-usability-heuristics/
- W3C, *Understanding Target Size (Minimum)*: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum/
- W3C, *Dialog (Modal) Pattern*: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- W3C, *HTML dialog technique H102*: https://www.w3.org/WAI/WCAG22/Techniques/html/H102

## Validation plan

Recruit five people from the intended friend-circle audience. Ask each to join an invitation, propose two times, interrupt and resume their draft, vote, finalize, confirm attendance and find a prior meetup. Observe task completion, errors, missed states and time to confirmation. Separately test keyboard-only use, screen-reader dialog announcements, 200% zoom, 320px reflow, mobile targets and reduced motion. Production browser/assistive-technology validation remains pending; automated checks do not substitute for it.

## Observed defects, not just recommendations

The browser session exposed an HTTP-preview UUID failure mislabeled as a network error, and a stale search filter that hid a meetup opened from the agenda. The source now uses a cryptographic UUID fallback, more accurate error classification, and one navigation helper that clears the query when opening a specific meetup. This evidence illustrates why logic tests and browser task checks are complementary.
