# School Management Software — Global Virgins Montessori Academy

[![CI](https://github.com/dennisnomo89/Myproject/actions/workflows/ci.yml/badge.svg)](https://github.com/dennisnomo89/Myproject/actions/workflows/ci.yml)

A web-based school management system that digitises the academic and administrative work of Global Virgins Montessori Academy: pupil records, attendance, results and report cards, fees, and communication between the school and parents.

The full requirements are in the [Software Requirements Specification](docs/SRS_School_Management_Software.docx).

## Features

| Module | What it covers |
|---|---|
| Authentication | Secure login with role-based access (Admin, Teacher, Bursar, Parent). "Forgot password" emails a one-time reset link that expires after 1 hour, with at most 3 requests an hour. Users are signed out after 30 minutes of inactivity, and changing a password signs out the account's other devices. |
| Students | Admission, enrolment, profiles, linking pupils to parents/guardians |
| Staff | Teacher and non-teaching staff records, class/subject assignment |
| Academics | Sessions, terms, classes, subjects |
| Timetable | Weekly class timetables with clash checks (no overlapping periods, no teacher in two classes at once), each teacher's own week, and today's lessons on the teacher dashboard |
| Calendar | School events calendar (holidays, exams, meetings, activities) shown to everyone, staff only or parents only, with upcoming events on every dashboard |
| Attendance | Daily class attendance and summaries |
| Results | CA and exam scores, Montessori observations, auto-graded report cards |
| Fees | Fee structures, invoices, payments, receipts, outstanding balances |
| Communication | Announcements, plus private messages between parents and staff. Teachers can message parents of pupils in their classes; parents can message their children's teachers and the school office. There's an unread badge in the sidebar, and new messages are emailed. |
| Email notifications | Parents are emailed when results are published, when a payment is recorded, when the bursar sends fee reminders, and for announcements. Each user can opt out on their profile. |
| Reports | **Reports** page with enrolment by class and gender, attendance summary (term or chosen dates), academic performance (average, grade and position in class) and fee collection (billed, paid, balance). Filter by term and class, then view on screen, print, or download as a CSV file that opens in Excel. The bursar sees the enrolment and fee reports. |
| Data backup | Automatic daily backups (the newest 14 are kept), "Back up now", download, and restore with typed confirmation. A safety backup is taken automatically before every restore. |

## Tech stack

- **Frontend:** React 19 + Vite, React Router
- **Backend:** Node.js + Express (REST API), JWT authentication, bcrypt password hashing
- **Database:** Sequelize ORM, with SQLite for development (no install needed) and MySQL for production
- **Testing:** Jest + Supertest
- **Version control:** Git + GitHub

## Roles

| Role | Can do |
|---|---|
| Admin | Everything: users, classes, subjects, pupils, sessions/terms, publishing results, fees, audit log |
| Teacher | Attendance and scores for their own classes and subjects, Montessori observations, report remarks, announcements to parents/staff |
| Bursar | Fee structure, record payments, receipts, collection and debtor reports |
| Parent | Their own children's attendance, published report cards, fee statements and receipts |

## Project structure

```
school-management-system/
├── client/                  # React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── components/      # Layout (sidebar/top bar) and shared UI pieces
│       ├── context/         # AuthContext: logged-in user and token
│       ├── pages/           # one file per screen (Dashboard, Students, Attendance, ...)
│       └── services/        # API client, data-loading hook, formatting helpers
├── server/                  # Express backend
│   ├── src/
│   │   ├── config/          # environment and database connection
│   │   ├── controllers/     # request handlers per module
│   │   ├── middleware/      # authentication, role checks, data-access scoping, errors
│   │   ├── models/          # Sequelize models and relationships
│   │   ├── routes/          # all API routes and who may call them
│   │   ├── utils/           # grading scale, audit logging, errors
│   │   ├── db/              # migration runner and command line
│   │   └── seed.js          # demo data
│   ├── migrations/          # numbered database changes, applied in order
│   ├── tests/               # API tests
│   └── .env.example
├── database/
│   └── schema.sql           # original design schema (reference for the report)
└── docs/                    # SRS, diagrams (use case, ERD, DFD)
```

## Getting started

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
# 1. Clone the repository
git clone https://github.com/<your-org-or-username>/school-management-system.git
cd school-management-system

# 2. Backend
cd server
cp .env.example .env      # defaults work for local development
npm install
npm run seed              # builds a fresh database with demo data (wipes the dev database)
npm run dev               # API on http://localhost:5000/api

# 3. Frontend (in a second terminal)
cd client
npm install
npm run dev               # app on http://localhost:5173
```

### Demo accounts

After `npm run seed`, all demo accounts use the password `Password123`. These are for local testing only.

| Role | Email |
|---|---|
| Admin | admin@gvma.test |
| Bursar | bursar@gvma.test |
| Teacher (Nursery 2 A) | ada.teacher@gvma.test |
| Teacher (Primary 1 A) | tunde.teacher@gvma.test |
| Parent (2 children) | parent@gvma.test |
| Parent (1 child) | amina.parent@gvma.test |

### Running tests

```bash
cd server
npm test
```

GitHub runs the same checks automatically (`.github/workflows/ci.yml`) on every push to `main` or a `feature/...` branch, and on every pull request:

- API tests on Node 22 and Node 24
- Web app lint and production build

The result shows as ✓ or ✗ next to each commit and at the bottom of each pull request. Don't merge a pull request with a ✗: open **Details** to see which test failed.

### Email notifications

With no SMTP settings, emails are only recorded, and admins can read them on the **Email Log** page. That's useful for demos. To send real emails, fill in the `SMTP_*` and `MAIL_FROM` settings in `server/.env` (see `.env.example`) and restart the server. Tests never send real email.

| Event | Who is emailed |
|---|---|
| Admin publishes a term's results | Parents of every active pupil, with a link to the report card |
| Bursar clicks **Email reminders to parents** (Fees → Outstanding balances) | Parents of pupils who still owe for the term |
| A payment is recorded | That pupil's parents, with the receipt number and remaining balance |
| An announcement is posted (with "Also send by email" ticked) | Everyone in the chosen audience, except the poster |
| A message is sent | The other person in the conversation |

### Data backup

Admins manage backups on the **Data Backup** page.

- **Automatic:** while the server runs, it backs up the whole database every `BACKUP_INTERVAL_HOURS` (default 24) and keeps the newest `BACKUP_KEEP` (default 14). Manual and "before restore" backups are never deleted automatically.
- **Format:** each backup is a gzipped JSON file in `server/backups/` (set `BACKUP_DIR` to change this). Because it's JSON rather than a database file, the same backup restores on SQLite or MySQL.
- **Restore:** replaces all data with the backup's. You must type `RESTORE` to confirm, and the current data is saved as a "Before restore" backup first, so a mistaken restore can be undone.
- **Keep copies elsewhere:** download backups regularly and store them away from the server, for example on an external drive or a cloud drive. A backup that sits only on the server is lost if the server's disk fails.
- **Handle with care:** backups contain pupils' personal data and password hashes. Never commit them to Git (`backups/` is already in `.gitignore`), and store downloaded copies securely.

### Database migrations

The database structure is changed only through **migrations**: numbered files in `server/migrations/`, applied in order. A table called `SequelizeMeta` records which ones have run, so each change is applied once and **existing data is kept**. The server applies any new migrations automatically when it starts.

```bash
cd server
npm run migrate:status          # what has run and what is pending
npm run migrate                 # apply pending migrations
npm run migrate:create add-blood-group   # new empty migration to fill in
npm run migrate:undo            # undo the most recent migration
```

**To change the database** (for example, add a column):

1. Run `npm run migrate:create <short-name>` and fill in `up()`, plus a `down()` that reverses it.
2. Make the same change to the model in `server/src/models/index.js`.
3. Run `npm test`. A test compares every model with the migrated tables and fails if they don't match, so CI catches a forgotten migration.

Never edit a migration that has already been merged, because other databases have already run it. Add a new migration instead. Take a backup before running migrations on the school's live data.

Databases created before migrations were introduced are adopted automatically: the first migration sees that the tables exist and is simply recorded as done.

### Using MySQL

In `server/.env`, set `DB_DIALECT=mysql` and fill in `DB_HOST`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`. Create the empty database first. The migrations create the tables when the server starts, or when you run `npm run migrate`.

## Working in VS Code

Open the `myproject` folder in VS Code (**File → Open Folder**). It offers to install the recommended extensions (Oxc for linting, SQLite Viewer for looking inside the database); accept them.

**Tasks** (**Terminal → Run Task…**):

| Task | What it does |
|---|---|
| App: install dependencies | `npm install` in `server/` and `client/` (once, and after package.json changes) |
| App: reset demo data | Fills the development database with the demo accounts |
| App: start (API + web app) | Starts the API on port 5000 and the web app on port 5173, each in its own terminal |
| App: run tests | All API tests (also **Ctrl+Shift+P → Tasks: Run Test Task**) |
| App: lint web app / build web app for production | Lint the React code / write `client/dist` |
| App: database migration status / new database migration | Check or create migrations |
| Docs: … | Rebuild the report, slides and diagrams (**Ctrl+Shift+B** builds them all) |

**Debugging** (**Run and Debug**, Ctrl+Shift+D, then F5): *Debug API* runs the server with breakpoints, *Debug all API tests* and *Debug the open test file* run Jest under the debugger, *Debug web app in Edge* opens the web app with breakpoints in the React code, and *Debug API + web app* does both at once.

## Online demo on Render

`render.yaml` sets up a free demo on [Render](https://render.com) that anyone can open in a browser:

1. Sign in to Render with GitHub and choose **New → Blueprint**.
2. Pick this repository; Render reads `render.yaml` and creates the `gvma-sms` web service.
3. Wait for the first deploy, then open the `https://….onrender.com` address it shows and sign in with a demo account.

Every push to `main` deploys again. The demo is for showing the system, not for real school data:
- Each deploy builds a fresh database with the demo data. The free plan has no lasting disk, so changes made in the demo disappear when it redeploys or sleeps.
- After 15 minutes without visitors the free service sleeps; the next visit takes about a minute to wake it.
- Emails are only recorded in the Email Log, because no email account is configured.

## Deploying for the school

In production the API serves the built web app, so the school runs **one** Node.js server.

**1. Build and install** on the server (Node.js 20 or newer):

```bash
cd client && npm ci && npm run build
cd ../server && npm ci --omit=dev
```

**2. Configure `server/.env`.** Copy it from `.env.example`, then set at least:

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | A long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. The server **refuses to start** without a strong one. |
| `APP_URL` and `CLIENT_ORIGIN` | The portal's public address, e.g. `https://portal.gvma.example`, so links in emails work |
| `SMTP_*`, `MAIL_FROM` | The school's email account, so emails are actually sent |
| `TRUST_PROXY` | `1` if it runs behind Nginx, Caddy or a hosting platform |
| `DB_*` | Keep SQLite for one small server, or set up MySQL |

**3. Start it:**

```bash
cd server && npm start
```

Migrations run automatically on start. The first time, create the admin account with `npm run seed` on a test copy only (it wipes data), or add a real admin directly. For the live school, delete or deactivate the demo accounts.

**4. Put it behind HTTPS.** Run a reverse proxy such as Caddy or Nginx in front of port 5000 with a free Let's Encrypt certificate, so passwords are encrypted in transit (SRS 4.2). Keep the Node process running with a service manager (systemd, PM2, or your hosting platform).

At startup the server checks its settings. It **stops** if `JWT_SECRET` is missing or weak, and **warns** if email links point at localhost, the address isn't HTTPS, SMTP isn't set, or it's using SQLite.

**Built-in protections:**
- Security headers, including a Content-Security-Policy (Helmet)
- Passwords hashed with bcrypt
- After 10 failed sign-ins for one email from one address in 15 minutes, further attempts are refused for 15 minutes
- Password reset requests are limited per address and per account
- Sessions end after 30 minutes of inactivity

## API overview

All endpoints are under `/api` and, except login, need an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET/PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Users | `GET/POST /users`, `PATCH /users/:id` |
| Sessions/terms | `GET/POST /sessions`, `GET /terms/current`, `PATCH /terms/:id`, `POST /terms/:id/set-current` |
| Classes/subjects | `GET/POST /classes`, `PATCH/DELETE /classes/:id`, `POST/DELETE /classes/:id/subjects`, `GET/POST/DELETE /subjects` |
| Students | `GET/POST /students`, `GET/PATCH /students/:id`, `POST/DELETE /students/:id/parents` |
| Attendance | `GET/POST /attendance`, `GET /attendance/student/:id` |
| Results | `GET/POST /scores`, `GET /results/broadsheet`, `GET /results/report/:studentId`, `POST /results/observations/:id`, `POST /results/remarks/:id` |
| Fees | `GET/POST /fees/items`, `GET /fees/statement/:studentId`, `POST /fees/payments`, `GET /fees/payments/:id/receipt`, `GET /fees/reports/collection`, `GET /fees/reports/debtors` |
| Timetable | `GET /timetable?classId=`, `GET /timetable/mine`, `POST /timetable`, `PATCH/DELETE /timetable/:id` |
| Events | `GET /events?from=&to=`, `POST /events`, `PATCH/DELETE /events/:id` |
| Messages | `GET /messages/contacts`, `GET /messages/unread-count`, `GET/POST /messages`, `GET/POST /messages/:id` |
| Notifications | `POST /fees/reminders`, `GET /email-log` |
| Reports | `GET /reports`, `GET /reports/:type?termId=&classId=&from=&to=&format=csv` (type: `enrolment`, `attendance`, `performance`, `fees`) |
| Backups | `GET/POST /backups`, `GET /backups/:name/download`, `POST /backups/:name/restore`, `DELETE /backups/:name` |
| Other | `GET /dashboard`, `GET /audit-log`, `GET/POST/DELETE /announcements` |

Scores are CA out of 40 and exam out of 60. Grades: A 70+, B 60–69, C 50–59, D 45–49, E 40–44, F below 40 (see `server/src/utils/grading.js`).

## Team

| Name | Matric No. | Role | GitHub |
|---|---|---|---|
| Samuel Batu | [Matric No.] | [Role] | @username |
| Fred Wosornu | [Matric No.] | [Role] | @username |
| Seth Mensah Quaye | [Matric No.] | [Role] | @username |
| dennisnomo89 | [Matric No.] | [Role] | @dennisnomo89 |

## Contributing

Every member must commit their own work from their own GitHub account. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and commit workflow.

## License

Developed as an academic project for [Course Code and Title], [Institution Name].
