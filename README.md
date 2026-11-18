# FinTrack

FinTrack is a small educational expense-tracking demo. It lets signed-in users record personal transactions, split expenses with friends and groups, review balances, and record settlements. It does not move money.

## Architecture

- **Frontend:** static HTML, CSS, and JavaScript in [`frontend/`](frontend/).
- **Hosting:** GitHub Pages, deployed from the `frontend/` directory by [the Actions workflow](.github/workflows/deploy-frontend.yml).
- **Authentication and database:** Supabase Auth and PostgreSQL, called directly from the browser using the Supabase JavaScript client.
- **Backend service:** none. There is no Render service or separate server.

The browser-safe Supabase URL and publishable key are in `frontend/supabase-config.js`. A publishable key is public by design; never put a Supabase secret, `service_role` key, or database password in frontend files.

## Run locally

Requirements: Node.js (only needed for the included test and optional Supabase CLI tooling) and Python 3 for a simple static server.

```sh
cd frontend
python3 -m http.server 5500
```

Open <http://localhost:5500>. The current frontend configuration points to the existing Supabase project. Add the local origin to Supabase Auth redirect URLs if testing signup confirmation.

## Tests

From the repository root:

```sh
node --test frontend/tests/finance.test.js
```

There is no bundler or frontend build step. See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages setup, database notes, and the current verification status.

## Database source

The schema snapshot is [`database/fintrack_schema.sql`](database/fintrack_schema.sql). SQL changes are stored in both `database/migrations/` and `supabase/migrations/`; review them against the hosted project's migration history before applying anything. Do not use the schema snapshot as a production reset.

Before presenting the current hosted demo publicly, apply `supabase/migrations/20261117130000_public_demo_security.sql` in the Supabase SQL editor. It consolidates the earlier membership and settlement policy scripts, closes anonymous database grants, and tightens friendship and group-member insertion. Apply this single file instead of running those older scripts separately. Then test the app's authenticated feature flows with a designated test account.
