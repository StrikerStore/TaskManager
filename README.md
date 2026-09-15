# TaskBoard

A shared task list for a small team, plus private personal tasks. Backend and frontend
are separate apps in one pnpm workspace, and the UI is built for both desktop and phones.

```
backend/    Express 5 + TypeScript REST API, Drizzle ORM, MySQL 8, Better Auth
frontend/   Next.js 16 (App Router) + Tailwind 4, TanStack Query
```

## What it does

- **Teams** — create a team, or join one by typing its **team code**; the owner accepts or
  declines each request. A person can belong to several teams, and each team's data is separate.
- **Projects** — colour-coded groups of tasks, visible to the whole team.
- **Tasks** — title, notes, status, priority, assignee, due date.
- **Personal tasks** — visible only to the person who wrote them, even inside a shared team.
- **Filters** — project, assignee, status, priority, due window, scope, search, grouping
  and sorting. All filter state lives in the URL, so a view can be bookmarked or shared.
- **Quick add** — type a title, pick a project and assignee from the two dropdowns, press
  Enter. "Personal" sits at the top of the project list; choosing it makes the task private
  and assigns it to you.
- **Recurring tasks** — rules that create a task on a schedule (daily, weekly, every two
  weeks, monthly) at a set trigger time, with a fixed assignee and a due date N days out.
  A rule can fire on **several days**: tick Mon and Thu for twice a week, or the 1st and
  15th for twice a month.
- **Accounts** — just a name, a username and a 6-digit passcode. No email, no password.

## Setup

### 1. Database

MySQL 8 must be running (on Windows it is usually the `MySQL80` service). Create the database:

```sql
CREATE DATABASE taskboard CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

### 2. Environment

`backend/.env` already exists with a generated `BETTER_AUTH_SECRET`. Put your MySQL
username and password into `DATABASE_URL`:

```
DATABASE_URL=mysql://root:your-password@localhost:3306/taskboard
```

`frontend/.env.local` points at the API and needs no changes for local work.


### 3. Install and create the tables

```bash
pnpm install
pnpm db:migrate     # applies backend/drizzle/*.sql
```

### 4. Run both apps

```bash
pnpm dev            # API on :4000, web on :3100
```

Open http://localhost:3100, create an account, then create a team or join one with its code.

## Deploying to Railway

The project runs on Railway as three services in one project:

```
Browser ──https──▶ web (Next.js)  ──/api/* over private network──▶  backend (Express + scheduler) ──▶ MySQL
                   public domain                                     no public domain
```

Only `web` is public. It forwards `/api/*` to `backend`, so the login cookie is first-party and
works on Safari and iPhone, and the API itself is never exposed to the internet.

Both app services deploy the same repository. Railpack reads the build and start commands from
the root `package.json`, and [`scripts/railway.mjs`](scripts/railway.mjs) picks the app from one
variable, **`TASKBOARD_APP`**. On `backend` it runs the database migrations before starting.

### 1. Put TaskBoard in its own GitHub repository

Push this folder — and only this folder — as a new repository. Railway deploys from it.

### 2. Create the services

In Railway: **New Project → Deploy from GitHub repo** and pick the repository. Then, in the same
project, add a second service from the same repository, and **New → Database → MySQL**.
Rename the two app services to **`web`** and **`backend`**; the variable references below use
those names.

### 3. Configure `backend`

- **Variables:**

  ```
  TASKBOARD_APP=backend
  DATABASE_URL=${{MySQL.MYSQL_URL}}
  BETTER_AUTH_SECRET=<a long random string, e.g. from: openssl rand -base64 32>
  BETTER_AUTH_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
  APP_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
  PORT=4000
  NODE_ENV=production
  TZ=Asia/Kolkata
  ```

- **Settings → Config file path:** `/backend/railway.json` — optional, but it adds watch paths
  (so a frontend change does not rebuild the API) and a health check at `/health`.
- **Do not** generate a public domain.
- Keep it at **one replica** with **serverless off**: the recurring-task scheduler runs inside this
  process, so a second replica would create every recurring task twice, and a sleeping service
  creates none.

### 4. Configure `web`

- **Variables:**

  ```
  TASKBOARD_APP=web
  API_INTERNAL_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:4000
  PORT=3000
  NODE_ENV=production
  ```

  `API_INTERNAL_URL` is baked in when the app is built, so after changing it, redeploy `web`.
- **Settings → Config file path:** `/frontend/railway.json` — optional, as above.
- **Settings → Networking → Generate Domain**, target port **3000**.

### 5. Deploy

Deploy both services. `backend` applies any pending migrations each time it starts; if a migration
fails, the service does not start and the deploy shows as failed. Then open the `web` domain and
create the first account.

If a service fails with *"TASKBOARD_APP is not set"*, add that variable to the service and redeploy.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the API and the web app together |
| `pnpm build` | Builds both |
| `pnpm db:generate` | Writes a new SQL migration after a schema change |
| `pnpm db:migrate` | Applies pending migrations |
| `pnpm db:studio` | Opens Drizzle Studio against the database |
| `pnpm -F frontend test` | Frontend unit tests (filter URLs) |
| `pnpm -F backend test` | Backend unit tests (recurrence maths) |
| `pnpm -F backend smoke` | End-to-end API check against the running server and real MySQL |
| `pnpm -F backend lint` | Typechecks the API |
| `pnpm -F frontend lint` | Lints the web app |

`pnpm -F backend smoke` needs the API running (`pnpm dev`). It signs up three people with passcodes, has two ask to join a team by code
(one accepted, one declined), and asserts the access and visibility rules from the outside —
including that a pending or declined request gives no access, and that a personal task
cannot be seen or edited by a teammate.

## How it fits together

The frontend never touches MySQL. Browsers only ever talk to the web app; it forwards everything
under `/api/*` to the Express API ([`frontend/next.config.ts`](frontend/next.config.ts)), so the
session cookie is first-party. Requests carry an `x-team-id` header naming the current team.

- `POST /api/auth/*` — Better Auth, plus our passcode endpoints: `sign-up/passcode`,
  `sign-in/passcode`, `passcode/change`
- `POST /api/teams/join`, `GET|DELETE /api/teams/my-requests` — asking to join a team
- `GET /api/teams/code`, `POST /api/teams/code/rotate`, `GET /api/teams/requests`,
  `POST /api/teams/requests/:id/accept|reject`, `GET|DELETE /api/teams/members` — owner tools
- `GET|POST /api/projects`, `PATCH|DELETE /api/projects/:id`
- `GET|POST /api/tasks`, `PATCH|DELETE /api/tasks/:id`, `POST /api/tasks/:id/toggle`
- `GET|POST /api/recurring`, `PATCH|DELETE /api/recurring/:id`, `POST /api/recurring/:id/run-now`

Every task route runs the same visibility rule on the server
([`backend/src/routes/tasks.ts`](backend/src/routes/tasks.ts)): a task is visible when it
belongs to the team **and** (it is a team task **or** the caller created it). Team
membership is checked on every request in
[`backend/src/middleware/require-team.ts`](backend/src/middleware/require-team.ts), and
the API never trusts a team id sent in a request body.

## Ports

In development the web app runs on **3100** (port 3000 was taken on this machine) and the API on
**4000**. You open only the web app; it proxies `/api/*` to the API. `BETTER_AUTH_URL` and
`APP_URL` in `backend/.env` must be the web app's address, or sign-in is rejected.

## Recurring tasks

A rule stores what to create (title, project, fixed assignee, priority), when to create it
(frequency, a **set** of weekdays or days of the month, trigger time) and how long the task
then has (`dueOffsetDays`).

Days are stored as a sorted CSV (`weekdays = "1,4"`), and `computeNextRun` builds one
candidate per selected day and takes the earliest. "Twice a week" is therefore not a separate
frequency — it is a weekly rule with two days ticked, which also gives 3×, weekdays-only and
weekends-only for free. For monthly rules, 29–31 clamp to the last day of shorter months and
are de-duplicated, so a "30th and 31st" rule fires once in February, not twice.

The scheduler in [`backend/src/lib/scheduler.ts`](backend/src/lib/scheduler.ts) wakes every
60 seconds, creates a task for every rule whose `nextRunAt` has passed, then rolls the rule
forward. Two deliberate choices:

- **Times are the API server's local time**, not each person's timezone.
- **A missed stretch produces one task, not one per period.** If the server is off for a
  week, a daily rule creates a single task on restart rather than seven.
- **Bi-weekly parity is anchored to the rule's creation week**, not to its last run, so a run
  missed while the server was down does not permanently shift which week it fires in.

Run `POST /api/recurring/:id/run-now` (the ⚡ button) to create one immediately without
waiting, and pause a rule instead of deleting it to keep its history.

## Accounts and teams

**Accounts** are a name, a username and a 6-digit passcode — there is no email and no password
anywhere. The passcode endpoints live in a small Better Auth plugin,
[`backend/src/lib/passcode-plugin.ts`](backend/src/lib/passcode-plugin.ts). Better Auth's user
table still insists on a unique email, so each account carries a placeholder
(`username@taskboard.local`) that is never shown and never sent anything.

**Teams** are joined by code, not by invitation:

1. The owner opens **Team** and shares the 8-character code (e.g. `K7QP-4M2X`).
2. The new person signs up, chooses **Join with a code**, and types it.
3. The request appears on the owner's Team page to **accept** or **decline**. Until it is
   accepted the person has no access at all. Owners and admins can decide requests.

A new code can be issued at any time; the old one stops working immediately.

**Passcode safety.** There is no lockout — wrong attempts never block an account. Instead:

- sign-in, sign-up and passcode changes are **throttled to 20 attempts a minute per address**,
  which a person never notices but turns guessing all million codes into weeks;
- **guessable passcodes are refused** — repeats like `111111` and runs like `123456`;
- **an unknown username and a wrong passcode get the identical response**;
- changing a passcode requires the current one, and the hash is never returned by the API,
  never written through `/update-user`, and stripped from the session cookie.

There is no "forgot passcode" flow: with no email there is nowhere to send a reset. Keep it safe.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | Focus the quick-add box |
| `/` | Focus search |
| `Enter` | Add the task |
| `Esc` | Close the detail panel |

## Navigation

Desktop sidebar: Tasks, Mine, Personal, Recurring, Projects, Team.
Phone tab bar: Tasks, Recurring, Projects, Team — Mine and Personal are left out because the
capsule row on the Tasks page already switches between those views.
