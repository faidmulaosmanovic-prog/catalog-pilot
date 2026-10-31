# Bug triage

Pilots file bugs and feedback in the workspace at `/app/feedback`. Each note belongs to one organization.

| Status | Meaning |
|--------|---------|
| open | New. Nobody has looked at it. |
| triaged | An owner or admin has accepted it and named a next step in the note or a follow-up. |
| resolved | Fixed, or the reporter confirmed the workaround. |
| wont_fix | Out of scope for this pilot. Say why in a reply to the reporter. |

Viewers and editors can file notes. Only an owner or admin can change status.

Severity is not a separate field. Put the impact in the title: blocked export, wrong CSV cell, or cosmetic. Blocked export and cross-organization data leaks are the ones to handle before the next pilot call.

Do not paste catalog rows, passwords, or Stripe secrets into a note.
