# Flexible training and onboarding

Implemented October 27, 2026 in the active Ink app. This supersedes the earlier
short setup and recurring sport schedule UI. No user history was reset or uploaded.

## Onboarding

The initial setup now has 12–16 short pages depending on sports, home equipment
and travel preferences. Most pages ask one concrete question, with plain choices
and a sensible starting selection. Optional name/gender and the age band share an
identity page. Each answered page has an animated response explaining the actual
effect of that answer. There is no simulated AI processing or required waiting.
The no-sport path explicitly says “That’s perfectly fine” and skips sport priorities.

Questions cover goal, experience, identity, sports/priorities, usual location, a
separate home setup, travel constraints when relevant, usual duration, a flexible
frequency target, movement exclusions and optional photos. The final summary
previews a real starting recommendation. Photos and AI consent are separate.

Progress saves when moving between pages or closing the setup. Reopening after a
reload resumes the saved question. Existing short-setup profiles are offered the
expanded setup once, with their existing values retained. After completing v2,
You → Training opens the summary for quick edits; “Review setup from the start”
replays the full flow without clearing data.

CSS transforms animate three small shapes; reduced motion follows both the
device preference and the app setting. The setup uses a full-height phone sheet
with fixed navigation and a scrolling body.

## One-off events

Home and Train have an event entry; History and Preferences also link to events.
Choose an activity/practice, game/competition, or occasion. Add one date and time,
approximate duration and effort. Common sports plus walks, hikes and physical
work use local presets, with no API cost. Events can be edited, moved, marked
done, cancelled and restored. Completed recent activities remain editable.

Recurring calendar controls and the Home week calendar are removed from the UI.
New/default-normalized profiles use one-off mode, so old recurring records no
longer affect recommendations. Those historical settings remain stored for backup
compatibility; they are not deleted or automatically converted into events.

An event time describes that activity, never a required workout appointment.
Times use the device’s local timezone. Nothing is synchronized to an external
calendar and no notification permissions are requested.

## Custom activity interpretation

“Something else” accepts a description and an explicit AI-consent checkbox.
Only that text goes to OpenAI, using `gpt-6-luna`, low reasoning, structured output,
`store:false`, a 600-token output cap, a 30-second timeout and no automatic retries.
No photos or saved workout history are sent by this endpoint. Description input
is limited to 700 characters, the route to 8 calls per 10 minutes, and AI concurrency
is shared with the existing photo routes. Requests and provider errors are not logged.

The AI supplies possible involved muscle areas, approximate effort, bounded
before/after windows, a short explanation and an uncertainty flag. An explicitly
stated duration is extracted; when it is unstated, the editable duration already
in the form is retained. Easy/uncertain
activity has no automatic reduction window. Normal activity is capped at 24 hours
before/12 after; hard activity at 48 before/24 after. These are planning heuristics,
not measured recovery. The user reviews the interpretation and can edit effort or
areas before saving. Unchanged accepted descriptions are not re-requested by the UI.
Failed requests leave the manual alternative available and never apply guessed output.

## How recommendations change

Upcoming or recent physical events can reduce sets and suggested loads and lower
the priority of involved areas. An upcoming selected sport competition within
seven days can prioritize compatible sport areas before the reduction window.
This is a flexible next-session recommendation, not a fixed seven-day program or
a promise of improved performance. Adding an event late only changes what is
still ahead. Past planned events are described as planned, never as confirmed attendance.

Moving, cancelling, or changing effort updates future suggestions. Windows expire;
there is no make-up-workout debt. Normal session preparation still asks for the
time and location available now, and checks energy and sore/avoided areas.
No workout is assigned to a weekday or start time. Frequency targets use any seven days.

An already prepared or active session remains unchanged; re-plan it to use a newly
added event. This prevents exercises changing unexpectedly during a set. Preparing
a session never starts its timer.

## Occasions and short sessions

An occasion can open an optional 5-, 10- or 15-minute focused session. Select areas
in the event or change them for that session in its options. Exercises still fit
the chosen location, equipment, available dumbbell loads and movement constraints.
Sore, painful, recently trained and event-protected areas are omitted; an empty
result explains the conflict and offers focus changes instead of forcing a workout.

Work is limited to one or two easy sets per movement, without maximal lifts,
failure sets, progression or side-extra reps. No change in definition is guaranteed;
any pump is temporary. Logged short sessions remain in History but do not inflate
strength days, strength volume, PRs or future progression baselines. Their actual
muscle use still informs recent-training avoidance.

## History

Searchable timeline with 7-day, 30-day or all-time views, plus filters for training,
warmups, short sessions, light movement, reported activities and photo check-ins.
Only explicitly completed reported activities appear as done; upcoming and
cancelled events do not count as training. Sample/future records are excluded.
Distinct strength days and actual completed sets have separate counts.

Per-exercise history shows recent logged sets, converts mixed units and separates
changed exercise definitions rather than claiming a like-for-like improvement.
Sessions can still be inspected and repeated. Detailed volume and personal bests
are secondary, and empty weekly recaps are hidden until there are actual sessions.

## Verification and limits

- 82 app tests and 6 server tests cover event timing/expiry, cancellation, immutable
  history, competition lookahead, atomic updates, pump limits, exclusions, reset
  behavior, token-free injected API paths, consent, origins and provider failures.
- Build, native/server type checks, Expo lint and web undefined-symbol checks pass.
- Browser checks at phone size cover the full no-sport onboarding, close/reload
  resume, a live Luna interpretation of a fictional activity, event save, History,
  and manual preparation of an occasion session. The test used an isolated browser
  origin with fictional data; ordinary browser and Expo Go stores were not reset.
- Physical iPhone behavior and exercise outcomes were not verified. No paid photo
  analyses or image generation were used for this work. The custom text-only
  canary used one live Luna request; other API tests used injected responses.
- Data remain local to each device/browser store; this adds no cloud accounts,
  group synchronization, external-calendar integration or background reminders.
