# Bozo Lay Tracker

A mobile-first React and Blueprint app for the group’s weekly picks.

Run `npm ci` and `npm run dev`. Run `npm run build` to generate `dist/`.

The app uses the BonkHeads Supabase Data API with a publishable key. No account or access code is required. Picks can be added, edited, or cleared on the open weekend. Once all five picks are saved, the group can mark multiple BOZOs. Finalize the weekend after marking at least one BOZO to open the following weekend and archive the completed picks and BOZOs in History. Shared changes refresh every five seconds while the app is open.

The rotation starts with Jack for the November 28–29, 2026 weekend, with a Saturday noon Eastern deadline. Supabase stores dates by the Monday starting each week. The migrations in `supabase/migrations/` apply to the existing tracker schema.

Use the header’s **Test mode** toggle to try an isolated weekend. Test picks and History persist in the current browser. Finalizing a test weekend opens its History entry and starts the next test weekend.
