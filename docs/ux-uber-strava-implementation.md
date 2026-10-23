# Uber Eats × Strava UX Program — Implementation Record

**Source:** external product/UX review (2026-07-12) of the public Landing Page, App Store listing,
Support and legal pages. Core principle:

> Learn from Uber Eats how to let a user *complete one log with zero anxiety*;
> learn from Strava why they *come back tomorrow because they can see themselves improving*.
>
> Loop: fast log → trusted confirm → immediate advice → long-term progress → (opt-in) social.

This doc records what was implemented in code, what is delivered as ready-to-paste content, and
what needs an external/manual action. The **Implementation status** table at the bottom maps every
checklist item from the review.

---

## 1. Product one-liner (converged)

> **The fastest, most trustworthy, most correctable photo-first nutrition logger.**

Differentiation is NOT "AI understands your food" (table stakes — SnapCalorie, Cal AI, Foodvisor,
Lifesum all scan photos). It is:

> **Depth-aware portion estimation, and transparent, editable nutrition math.**

Training, recipes, weight and glycemic insights serve this main line; they are not four sibling
products.

## 2. Brand decision (Option B)

- Product name: **Metriful**
- Byline everywhere: **Metriful by Aura Fitness**
- Domain stays `aurafitness.org`.
- Rationale: the App Store listing (id6760930295) already ships as "Metriful"; renaming a live
  listing costs more than unifying the byline. ⚠️ Note: "Metriful" is also an existing indoor
  air-quality sensor brand (metriful.com) — **run a formal trademark + App Store name search before
  spending on marketing**. This is an external action; not code.

**Canonical support email: `support@aurafitness.org`.**
Evidence (2026-07-12): `aurafitness.org` has Cloudflare Email Routing MX records;
**`aurafitness.app` has no DNS records at all** (NXDOMAIN — no MX, no A). Every occurrence of
`support@aurafitness.app` is a dead address and was replaced in source.

---

## 3. App Store listing (ready to paste)

**Title:** `Metriful — AI Meal Scanner`
**Subtitle:** `Depth-aware calorie tracking`

**First two description lines (category-defining):**

```text
AI Meal Scanner & Nutrition Coach
Depth-aware portions, editable macros, and personalized daily guidance.
```

**Description body (suggested):**

```text
Snap a meal. Get an editable nutrition estimate.

Metriful uses your iPhone's depth sensor to estimate portion size — not just guess it —
then shows you every food it found, item by item, so you can fix anything in one tap.

• SCAN — point the camera at your plate. Depth-aware portioning on LiDAR iPhones.
• REVIEW — see each food with grams, calories and a confidence level. Edit in one tap.
• KNOW WHAT'S NEXT — after each log, one concrete suggestion based on what's left today.
• SEE PROGRESS — weekly check-ins that explain your habits, never shame them.
• TRAIN + EAT — recovery-meal reminders and training-day nutrition context.

Every number is an estimate, clearly labeled, with sources you can check
(USDA FoodData Central, Harvard Health). Estimated glycemic impact is a general
nutrition estimate — not a personal blood-glucose prediction or medical advice.

Free to start. No paywall before your first scan result.
```

**Six screenshots, one story (in order):**

1. **Snap your meal** — camera with depth reticle + "Depth: Good" pill
2. **See each food and portion** — itemized review with grams/kcal/confidence
3. **Correct anything in one tap** — portion chips (½ / 1 / 1.5×) + "Check" chip on a low-confidence item
4. **Know what to do next** — post-log sheet: "31 g protein remaining → protein-rich dinner"
5. **Understand your weekly progress** — weekly check-in card with Accept/Keep target
6. **Connect nutrition with training** — recovery-meal CTA after a workout

**Review prompt timing** (never on first launch; only at positive-value moments):
after 5th successful scan · first full weekly check-in viewed · 7th consecutive day ·
after a data export · right after the user marks a scan "accurate".

**Accessibility declaration:** after the a11y items below ship, declare VoiceOver, Dynamic Type,
Reduced Motion support in App Store Connect.

---

## 4. North Star & metrics (event schema)

**North Star:** `confirmed valid meal logs per weekly-active user` (not raw scans — bad scans inflate scans).

| Group | Metric | Event(s) |
|---|---|---|
| Activation | landing CTA CTR | `landing_cta_click / landing_view` |
| | install → first scan started | `scan_started` (first per user) |
| | first scan completion rate | `scan_completed / scan_started` |
| | time first-scan → confirm | `meal_confirmed.ts − scan_started.ts` |
| | % seeing result before signup | `scan_completed where auth=false` |
| Speed | scan→result median | `scan_completed.duration_ms` |
| | result→confirm median | `meal_confirmed.review_ms` |
| | repeat-meal log time | `meal_repeated.duration_ms` |
| | input-mode mix | `scan_started.mode ∈ {photo, gallery, text, barcode, repeat}` |
| Trust | one-tap accept rate | `meal_confirmed.edits == 0` |
| | avg edits per meal | `meal_confirmed.edits` |
| | low-confidence resolution rate | `clarify_answered / clarify_shown` |
| | post-edit undo rate | `meal_undo / meal_confirmed` |
| | "was this accurate?" yes-rate | `scan_feedback.accurate` |
| | most-corrected food categories | `item_edited.category` |
| Retention | D1/D7/D30, logging days/week | session + `meal_confirmed` days |
| | repeat-meal reuse rate | `meal_repeated / meal_confirmed` |
| | weekly check-in open + accept rate | `checkin_viewed`, `checkin_target_accepted` |
| Guardrails | notification off-rate, deletion completion, privacy-settings use, social mute/block, glycemic-info misunderstand reports | respective settings events |

---

## 5. Don't-do list (enforced in code where possible)

- No paywall before first value (first scan result is free, guest-scannable).
- Editing AI mistakes is never a paid feature.
- No public calorie/weight-loss leaderboards; challenges compare consistency, not bodies.
- Over-target numbers use neutral copy ("Above today's current target"), never red alarms.
- Model outputs always labeled *estimated*; never presented as measurements.
- Meals/weight/health data default **Only me**.
- One primary suggestion after each log — not five generic tips.
- No infinite spinner: staged progress with ETA; analysis can continue in background.
- Never force item-by-item confirmation; Confirm-whole-meal is always the primary CTA.
- Social/notifications must never slow the log itself.

---

## 6. Implementation status (2026-07-12 session)

Legend: ✅ implemented in code · 📝 ready-to-paste content in this doc · ⚠️ needs external/manual
action · ⏭ deferred with reason. Frontend verified: tsc clean, 15 suites / 134 jest tests green
(34 new tests). Backend suite 436 green (untouched by this UX work).

### P0 — Brand & website

| Item | Status | Where |
|---|---|---|
| One product name everywhere | ✅ | Byline "Metriful by Aura Fitness" (`LandingFooter`), share text "on Metriful" (`WeeklySummaryCard.tsx`); App Store Connect display name change is ⚠️ manual |
| Fix .org/.app support email | ✅ | `public/data-deletion.html` — `.app` was NXDOMAIN (dead); canonical `support@aurafitness.org` |
| Single hero promise | ✅ | `HeroSection.tsx`: "Snap a meal. Get an editable nutrition estimate." |
| SSR / static prerender | ✅ | `scripts/prerender-landing.mjs` injects full static landing + SEO/OG meta into the Expo export; wired into `postbuild` + deploy workflow; idempotent |
| Scan→itemize→confirm→advice demo on landing | ✅ (static) | Prerendered "From photo to logged meal" strip; in-app screenshots for the React landing are ⚠️ asset work |
| CTA "Scan your first meal" | ✅ | Hero + CTA banner (`LandingScreen.tsx`) |
| "How accuracy works" + limitations | ✅ | `AccuracySection.tsx` (React) + mirrored in prerendered HTML |
| Privacy summary on landing | ✅ | Same section; model-training claims deliberately not made (unverified) |
| Consistent feature naming across surfaces | ⚠️ | App Store copy lives only in App Store Connect — §3 of this doc is the paste source |
| Trademark/name search (Metriful sensor conflict) | ⚠️ | External legal action |

### P0 — First use

| Item | Status | Notes |
|---|---|---|
| Guest/demo scan before signup | ⏭ | Requires anonymous `/analyze` backend policy + abuse controls — product/security decision first |
| ≤3 onboarding questions, progressive profiling | ⏭ | OnboardingScreen restructure not attempted this session (large, untested surface); recommended next |
| Pre-permission explainers | ✅ (existing) | `PermissionRequestModal` already implements this pattern |

### P0 — Log entry / scan / review / post-log

| Item | Status | Where |
|---|---|---|
| Staged progress instead of spinner | ✅ | `ScanStagesList` (checklist ✓/active/pending) driven by `deriveScanStages` (tested) |
| Estimated time remaining | ✅ | Rolling average of recent scan durations; honest "finishing up" when overdue |
| Background analysis + home status chip | ✅ | `useScanStore` runs the pipeline outside the screen; `ScanStatusChip` on Dashboard; reopen via `{scanId}` |
| Depth-quality hint at capture time | ✅ | `VisionCameraView` pill: Good / hold steady / too close / too far / not available |
| Multi-plate select & shared-dish portioning | ⏭ | Needs segmentation UX + backend eval (per-item path is off by evidence — docs roadmap §11) |
| Itemized results w/ confidence | ✅ | `DetectedItemRow`: kcal/macros per item, "Check" chip <60% confidence (icon+text, not color-only) |
| ½/1/1.5× portion chips | ✅ | Per-item factor chips + existing ± stepper |
| Photo segmentation overlay | ⏭ | Gemini boxes not requested in prod schema (misassignment risk documented in roadmap §11) |
| One clarifying question at a time | ✅ | `ClarifyQuestionCard` + `clarify.ts` (portion sanity + hidden fats; max 2; tested) |
| Add missed / remove wrong items | ✅ remove; hidden-fats add via clarify | Full manual add-any-food search ⏭ (needs food DB search UI) |
| Confirm whole meal one CTA + Undo | ✅ | Save unchanged; post-log sheet has real Undo (DELETE /meals/{id}) |
| "How was this estimated?" drawer | ✅ | `HowEstimatedSheet`: portion method (depth vs photo), USDA cross-reference, per-scan confidence |
| Remembered corrections ("my rice is 180g") | ⏭ | Needs per-food user priors store + backend; flywheel item |
| Post-log: remaining + one next step | ✅ | Post-log sheet: kcal/protein remaining + `buildNextStep` (tested, neutral wording) |
| Voice / barcode / text input modes | ⏭ | No barcode/voice deps in the app today; add `expo-barcode-scanner`/speech as a follow-up |
| Quick Add calories | ✅ (existing) | Manual logging path already exists (`logMeal`) |

### P0 — Trust, safety, a11y

| Item | Status | Where |
|---|---|---|
| "Estimated glycemic impact" rename + non-medical note | ✅ | ReviewMealScreen GL card + tour step + About screen + release notes + references |
| "estimated" labels on AI numbers | ✅ | Item rows ("· estimated"), share text, HowEstimated sheet |
| Neutral over-target language | ✅ | next-step/ring/check-in copy; no red alarm added anywhere |
| a11y labels/roles on interactive elements | ✅ (new surfaces) | All new components + `Text` now passes a11y props; full legacy audit ⏭ |
| Dynamic type / reduced motion | ✅ partial | `allowFontScaling` default on; new timers/anim honor existing patterns; full audit ⏭ |
| App Store a11y declaration | ⚠️ | App Store Connect form (after audit) |

### P1

| Item | Status | Where |
|---|---|---|
| Visual diary timeline | ✅ | `MealHistoryScreen` → "Diary": photos, day grouping + daily kcal, type/favorites filters, search |
| Favorites + repeat | ✅ | `useMealFavoritesStore` (local) + per-card repeat via `useReLogMeal` (also fixed its stale query key) |
| Weekly check-in w/ approval | ✅ | `WeeklyCheckinCard` + `buildWeeklyCheckin` (tested): facts, coverage, ±120 kcal capped suggestion, Accept/Keep, insufficient-data state |
| Rings → where/why/next | ✅ | `buildRingInsight` (tested) + DetailBottomSheet on ring tap; recipe search preserved as secondary action |
| Safe streaks (pause, rest, neutral copy) | ✅ | `StreakSafetyCard` + `useStreakShieldStore` (3/7/14-day pause); StreakBadge finally mounted. Server-side rest-day grace ⏭ (backend streak semantics change) |
| Training→nutrition | ✅ | Workout finish event wired (was discarded) → `usePostWorkoutStore` → `RecoveryMealCard` (2h window). Training-day target adjustment ⏭ (needs per-day target model) |
| Meal tags (satiety/mood) | ⏭ | Needs meal metadata field |

### P2

| Item | Status | Where |
|---|---|---|
| Share cards, default private, sensitive fields hidden | ✅ | `ShareMealSheet` (calories OFF by default) + weekly share text de-calorized; nothing auto-publishes |
| Friends/coach kudos, per-meal visibility, groups/challenges | ⏭ partial | `FriendsFeedCard`/`ChallengesCard` exist client-side; real social graph/coach roles need backend |

### Nav restructure (Today | Diary | +Log | Progress | Plan)

⏭ deliberately not done in one pass: tab renames/moves break `navigate('Workouts'|'Recipes')`
call sites and the tour; recommended as its own PR. Current structure already gives:
Dashboard(Home)=Today, Diary=upgraded MealHistory, center FAB=+Log, WeeklyInsights=Progress.

### Metrics instrumentation

📝 Event schema in §4 — no analytics SDK is wired in the app today (⚠️ pick one first).
