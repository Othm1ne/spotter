# Spotter: gym app

**Read SPEC.md before any task.** Also follow AGENTS.md (Expo rules: check the SDK 57 docs, never trust memory for Expo APIs).

## Stack
- Expo SDK 57, Expo Router (routes in `src/app/`), TypeScript strict, `@/` alias for `src/`.
- Must run in Expo Go: only use modules bundled with Expo Go. Install with `npx expo install`.
- Storage: expo-sqlite, local only. Schema and migrations in `src/db/schema.ts` (bump `PRAGMA user_version`). Queries in `src/db/*.ts`, called with the db from `useSQLiteContext()`.
- Pure logic (e1RM, formatting, volume) in `src/lib/`, no React or db imports.
- Theme tokens in `src/constants/theme.ts`; the app is dark-only.

## Commands
- `npx expo start` (scan the QR code with Expo Go), `npx tsc --noEmit`, `npx expo lint`. Run typecheck and lint before calling a task done.

## Conventions
- Logging screens must stay fast and work one-handed: large tap targets, no blocking spinners.
- Screens reload their data on focus (`useFocusEffect`), so modals can write to the db and just `router.back()`.
