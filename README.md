# Bozo Lay Tracker

A mobile-first React and Blueprint app for the group’s weekly picks.

Run `npm ci` and `npm run dev`. Run `npm run build` to generate `dist/`.

The app uses the BonkHeads Supabase Data API with a publishable key. No account or access code is required. Picks can be entered, edited, or cleared during the current weekend’s week. Current and past weekends can each have multiple BOZOs. Shared changes refresh every five seconds while the app is open.

The rotation starts with Jack for the November 28–29, 2026 weekend, with a Saturday noon Eastern deadline. Supabase stores dates by the Monday starting each week. The migration in `supabase/migrations/` applies to the existing tracker schema.
