# Flexible visits and soreness selection

Implemented in the shared Ink UI for web and Expo Go.

- Training rhythm defaults to **Keep it flexible**, without a weekly target. Onboarding, Preferences, and the profile target editor all support optional targets. The saved numeric target is retained when switched off. Older saves acquire the flexible default without deleting progress.
- Home reports actual training days without a denominator in flexible mode. Target-based score and streak displays stay out of this mode. Saving a workout no longer celebrates a quota or shows a score change.
- Train has **Keep it short**, offering 5, 10, or 15 minutes. These use the current planner, equipment, readiness, event context, and recent sessions. Short mode starts with easy effort, allows at most three exercises/two sets each, includes 90 seconds to ease in, and fits its estimated time without shortening rests below 45 seconds. The usual duration preference is retained.
- After saving, an optional invitation links to short-session preparation. It does not book a day, create a workout, add an event, send a notification, or start a timer. The next actual visit rebuilds from current information. Pain, soreness, or very hard effort changes the invitation to leave room for a break. Finish reasons are retained in saved records.
- A return after seven or more days gets a neutral welcome and lighter starting targets. Progress is kept; no make-up volume is added.
- The soreness and avoid-loading check-ins now have a local SVG illustration with front/back views. Both body regions and labelled touch targets work. The eight existing planning groups are shoulders, chest, biceps, triceps, core, back, glutes, and legs. Either side selects the entire group; there is no claim of side-specific planning. Legs includes thighs and calves.
- Selection stays consistent between views and the accessible text list. Removable chips and Clear selections provide quick correction. Saved avoid-loading areas remain locked during a single-session check-in; edit those in Preferences.
- The illustration uses the existing theme, no generated photographs, network assets, new packages, or API credits. Colour transitions respect reduced-motion settings.

Validation: regression tests cover optional-target persistence, 5/10/15-minute plans across gym/home/on-the-go and movement preferences, every soreness group, no-fit cases, preview versus later readiness, return gaps, and saved early-finish reasons. Browser checks use a separate local origin so real training data is untouched. Browser verification does not establish physical iPhone behavior.
