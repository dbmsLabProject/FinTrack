# FinTrack – Expense Tracker

FinTrack is a simple expense-tracking application that helps users manage their personal expenses and split shared expenses with friends and groups. Users can track transactions, view balances and record repayments.

The project was developed as part of a Database Management Systems (DBMS) course.

## Features

- User registration and login.
- Add and manage personal transactions.
- Create groups and split expenses among members.
- Add friends and manage friend requests.
- View individual and group balances.
- Record settlements between users.
- Manage expense categories and preferred currency.

*Note: FinTrack records settlements but does not process actual payments.*

## Technologies Used

- **Frontend:** HTML, CSS and JavaScript.
- **Database:** PostgreSQL (Supabase).
- **Authentication:** Supabase Auth.
- **Hosting:** GitHub Pages.

## Architecture
flowchart LR
    Browser["User's Browser"]
    Pages["GitHub Pages<br/>Frontend (HTML, CSS, JS)"]
    Supabase["Supabase<br/>Authentication + Data API"]
    DB[("PostgreSQL Database")]

    Browser -->|Loads frontend| Pages
    Browser -->|Authenticated requests| Supabase
    Supabase -->|Reads and writes data| DB

## Database

The project uses a relational database consisting of 11 tables:

1. Users
2. Auth Providers
3. Icons
4. Categories
5. Friendships
6. Split Groups
7. Split Group Members
8. Transactions
9. Expense Splits
10. Settlements
11. Settlement Allocations

The database uses primary keys, foreign keys, constraints, relationships, functions, triggers and Row Level Security (RLS).

The database schema is available in `database/fintrack_schema.sql`.

Additional SQL changes are maintained in:
- `database/migrations/`
- `supabase/migrations/`

## Running Locally

**Requirements:** Python 3 and Node.js (for running tests).

1. Clone the repository.
2. Open the project folder in the terminal.
3. Run the following commands:

```bash
cd frontend
py -m http.server 5500
```

4. Open `http://localhost:5500` in your browser.

The application connects to the configured Supabase project. A local origin may need to be added to the Supabase authentication redirect URLs when testing registration.

## Testing

The expense-splitting and balance-calculation logic has automated tests.

Run them from the project root using:

```bash
node --test frontend/tests/finance.test.js
```

## Deployment

The frontend is hosted using GitHub Pages.

The GitHub Actions workflow in `.github/workflows/deploy-frontend.yml` automatically deploys the contents of the `frontend/` directory whenever changes are pushed to the `main` branch.

The hosted application is available at:

https://dbmslabproject.github.io/FinTrack/

Supabase Authentication must be configured with the deployed website URL as its Site URL and the corresponding URL as an allowed redirect URL.

## Security

The application uses Supabase Authentication and Row Level Security (RLS) to protect user data.

The browser uses a Supabase publishable key, while database access is controlled through permissions and RLS policies. Secret keys and database passwords must never be exposed in frontend code.

Before using the public demo, apply the latest consolidated security migration:

`supabase/migrations/20261117130000_public_demo_security.sql`

