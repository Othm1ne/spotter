# Spotter: gym app

A workout logger for me and my friends. Plan sessions, log them fast at the gym, and track progression. Free to build and run: no paid services, no premium tier.

## Platforms and distribution ($0)
- Expo (SDK 57) + TypeScript + Expo Router, one codebase for iOS and Android.
- iPhone: Expo Go, loading the project from the owner's Expo account (dev server or EAS Update). Friends on iPhone need access to the Expo project (Expo organization or shared account), because iOS Expo Go only loads projects the logged-in account can access.
- Android: free `.apk` from EAS Build (preview profile), sideloaded.
- Constraint: only modules bundled in Expo Go. No widgets, HealthKit/Health Connect, Live Activities or watch apps until we move to a development build.

## Principles
- Local-first: everything is stored on the phone in SQLite and works offline. Cloud sync comes later and is optional.
- Logging speed comes first: big tap targets, last time's numbers shown on every set, minimal typing.
- Weights are stored in kg.
- Dark theme, mobile-first, one-handed use.

## Data model (SQLite, `src/db/`)
- `exercises`: name, primary muscle, equipment, custom flag. Seeded with a starter list we wrote ourselves.
- `routines`, `routine_exercises`: saved session plans (exercise order, target sets).
- `workouts`: name, started_at, finished_at (NULL means in progress, so an unfinished workout survives the app being killed), notes.
- `workout_sets`: workout, exercise, exercise order, set index, weight, reps, done.

## Steps
1. **Log a workout** ✅ in progress
   - Start an empty workout, add exercises from a searchable library, log sets (kg × reps), tick them done.
   - Each set shows "previous": the same set from the last time you did that exercise. Tapping it copies the values.
   - Rest timer starts when a set is ticked, with -15s/+15s/skip and a local notification when it ends (works with the phone locked).
   - Finish or discard. History tab lists finished workouts (date, duration, volume, sets).
   - Progress tab: best set and estimated 1RM (Epley) per exercise.
2. **Routines**: create/edit routines, start a workout from a routine (pre-filled with last time's numbers), save a finished workout as a routine.
3. **Progress**: PR detection and badges when a workout is finished, e1RM and volume charts per exercise, weekly sets per muscle group, calendar heatmap.
4. **Body**: body weight and measurements, progress photos.
5. **Library and logging extras**: custom exercises, set types (warm-up, drop, failure), RPE, supersets, plate calculator, workout notes, kg/lb setting.
6. **Friends** (Supabase free tier): accounts, sync/backup, friends' workouts and PRs, weekly leaderboard.
7. **Smart progression**: suggested weight/reps from history, plateau detection.
