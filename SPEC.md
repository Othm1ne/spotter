# Spotter: fitness coach app

A premium-feeling fitness app for me and my friends: log training fast, follow a program built for your goal, track meals, and get coaching advice from AI. Free to build and run: no paid services, no premium tier.

## Platforms and distribution ($0)
- Expo (SDK 57) + TypeScript + Expo Router, one codebase for iOS and Android.
- iPhone: Expo Go, loading the project from the owner's Expo account (dev server or EAS Update). Friends on iPhone need access to the Expo project (Expo organization or shared account), because iOS Expo Go only loads projects the logged-in account can access.
- Android: free `.apk` from EAS Build (preview profile), sideloaded.
- Constraint: only modules bundled in Expo Go. No widgets, HealthKit/Health Connect, Live Activities or watch apps until we move to a development build.

## Principles
- Premium look: polished hierarchy, spacing, motion and haptics on every screen; dark theme only.
- Smart by default: pre-fill what we can predict (last time's numbers, targets from your profile), nudge instead of nag, one tap for the common action.
- Local-first: everything is stored on the phone in SQLite and works offline. Only AI features need the network.
- Logging speed comes first: big tap targets, minimal typing, one-handed use.
- Math that must be right (calories, macros, progression) is deterministic code in `src/lib/`, never AI.
- AI is free: Groq (free plan, `openai/gpt-oss-120b`) behind a Cloudflare Worker relay (`worker/`, free tier) that holds the API key, pins the model and caps request sizes. The app only knows the relay URL and a shared app token, from `.env` (`EXPO_PUBLIC_AI_URL`, `EXPO_PUBLIC_AI_TOKEN`; not committed). Free limits: ~1,000 requests/day, 8,000 tokens/min, no vision model.
- Weights are stored in kg.

## Data model (SQLite, `src/db/`, migrations in `schema.ts`)
- `exercises`: name, muscle group, equipment, custom flag, GIF path, secondary muscles and steps (JSON). 52 starter exercises with hand-written guides (`exercise-guides.ts`) plus ~1,240 from the bundled library (`exercise-library.json`, built by `scripts/build-exercise-library.mjs`).
- `routines`, `routine_exercises` (rest per exercise), `routine_sets` (kg × reps per set): saved workout plans.
- `workouts`: name, started_at, finished_at (NULL = in progress), routine_id.
- `workout_sets`: workout, exercise, order, set index, weight, reps, done, rest_seconds, completed_at.
- `body_weights`: one weigh-in per day.
- `coach_conversations`, `coach_messages`: saved AI coach chats.
- `foods` (per 100 g, barcode, favorite, last amount), `food_entries` (day, meal, nutrients snapshot), `water` (ml per day).
- `settings`: key/value (weekly goal, profile JSON).

## Done
- **Training**: live workouts with set circles, rest timer + notification, previous numbers, forgotten-workout handling; log a past workout; workout plans with per-set targets and rest; save a workout as a plan.
- **Library**: ~1,290 exercises across 16 muscle groups, animated GIF previews, muscles worked, steps; search + muscle + equipment filters.
- **Progress**: GitHub-style activity calendar, day streak and weekly-goal streak, weekly charts, sets per muscle, personal records, 25 achievements.

## Roadmap (build in this order, test each phase on the phone before the next)
0. **Cleanup** ✅: forgotten workouts end at the last ticked set; durations editable in history.
1. **You & your goal** ✅: onboarding (body stats, activity, goal, experience, schedule, equipment, injuries); calorie and macro targets (Mifflin-St Jeor + goal adjustment, with safe floors); body weight log with trend; targets adapt when the trend stalls.
4. **Meal tracking** ✅: Nutrition tab with daily calories/macros vs targets; add food by Open Food Facts search, barcode scan, AI text description; water; favorites, recents and "your usual" per meal; copy yesterday's meal. Photo logging waits for a free vision model.
2. **AI coach** ✅: Cloudflare Worker proxy; Coach tab chat that knows your profile, training and meals; guardrails (no medical advice, no unhealthy dieting).
3. **AI program** ✅: AI builds a multi-week program from your profile, picking from an equipment-filtered, injury-aware exercise list (offline template fallback); days saved as workout plans; next workout on Home; double progression with suggested weights, first-time and plateau (deload) hints.
5. **Nutrition & supplements** ✅: Coach review (today / last 7 days) with stats, calorie chart and AI wins/fixes/food ideas, cached until the log changes; weekly insight line on the Nutrition tab; hand-written supplement guide by evidence tier with personal "for you" reasons and doses; "Ask the coach" follow-ups open a new chat. The coach also knows the current program.
6. **Daily dashboard** ✅: tabs Home · Train · Nutrition · Coach · Profile. Home: greeting and weigh-in, today's program workout, calories ring with protein/water (+1 glass) and Log food, a rule-based coach tip (refuel, protein catch-up, water, weigh-in, lapsed training…) that opens a coach chat, streak/week/weight tiles and a Mon–Sun strip. Train: workout in progress, program, my workouts, activity calendar, recent workouts and full history.

## Later
- Custom exercises, set types (warm-up, drop, failure), RPE, supersets, plate calculator, kg/lb setting, progress photos, export/backup.
- Friends (Supabase free tier): accounts, sync/backup, friends' workouts and PRs, weekly leaderboard.
