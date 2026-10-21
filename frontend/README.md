# FinTrack frontend

## Supabase connection

The frontend uses the `bnwtrhuratqqgxvgqpyi` project and its browser-safe publishable key in `supabase-config.js`. Never place a Supabase secret or `service_role` key in frontend files.

Email/password sign-in and sign-up use Supabase Auth. Once signed in, the app reads account data under Row Level Security. Transactions and splits, group creation and membership, profile details and currency, categories, email-based friend requests, and repayment records write to Supabase. Group transaction writes call a PostgreSQL function so transaction rows and allocations commit atomically. The repayment feature records a settlement; it does not move money. The external identity-provider buttons in Settings remain demo toggles.

The database setup is included in the repository: `../database/001_sharedfin_schema.sql` followed by the migrations in `../database/migrations/`. These SQL files match the linked Supabase project, including the group-creation row-security fix in migration 004.

## Run locally

From the `frontend` folder, start a static HTTP server (for example, `py -m http.server 5500`) and open `http://localhost:5500`. Do not open `index.html` as a `file://` URL. For signup confirmation links, add your local origin to Supabase Auth URL Configuration, including `http://localhost:5500/**` in the allowed redirect URLs.

## GitHub Pages

The GitHub Actions workflow publishes only this `frontend` directory at `https://dbmslabproject.github.io/FinTrack/`. In Supabase Auth URL Configuration, set the Site URL to that address and add `https://dbmslabproject.github.io/FinTrack/**` to the allowed redirect URLs so signup confirmation links return to the hosted app.
