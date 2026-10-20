# School Management Software — Global Virgins Montessori Academy

A web-based school management system that digitises the academic and administrative work of Global Virgins Montessori Academy: pupil records, attendance, results and report cards, fees, and communication between the school and parents.

The full requirements are in the [Software Requirements Specification](docs/SRS_School_Management_Software.docx).

## Features

| Module | What it covers |
|---|---|
| Authentication | Secure login, password reset, role-based access (Admin, Teacher, Bursar, Parent) |
| Students | Admission, enrolment, profiles, linking pupils to parents/guardians |
| Staff | Teacher and non-teaching staff records, class/subject assignment |
| Academics | Sessions, terms, classes, subjects, timetables |
| Attendance | Daily class attendance and summaries |
| Results | CA and exam scores, Montessori observations, auto-graded report cards |
| Fees | Fee structures, invoices, payments, receipts, outstanding balances |
| Communication | Announcements, events calendar, teacher–parent messages |
| Email notifications | Parents are emailed when results are published, when a payment is recorded, when the bursar sends fee reminders, and for announcements. Each user can opt out on their profile. |
| Reports | Enrolment, attendance, performance and fee-collection reports |

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
│   │   └── seed.js          # demo data
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
npm run seed              # creates the SQLite database with demo data
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

### Email notifications

With no SMTP settings, emails are only recorded, and admins can read them on the **Email Log** page. That's useful for demos. To send real emails, fill in the `SMTP_*` and `MAIL_FROM` settings in `server/.env` (see `.env.example`) and restart the server. Tests never send real email.

| Event | Who is emailed |
|---|---|
| Admin publishes a term's results | Parents of every active pupil, with a link to the report card |
| Bursar clicks **Email reminders to parents** (Fees → Outstanding balances) | Parents of pupils who still owe for the term |
| A payment is recorded | That pupil's parents, with the receipt number and remaining balance |
| An announcement is posted (with "Also send by email" ticked) | Everyone in the chosen audience, except the poster |

### Using MySQL

In `server/.env`, set `DB_DIALECT=mysql` and fill in `DB_HOST`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`. Create the empty database first. Tables are created automatically when the server starts.

## API overview

All endpoints are under `/api` and, except login, need an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Users | `GET/POST /users`, `PATCH /users/:id` |
| Sessions/terms | `GET/POST /sessions`, `GET /terms/current`, `PATCH /terms/:id`, `POST /terms/:id/set-current` |
| Classes/subjects | `GET/POST /classes`, `PATCH/DELETE /classes/:id`, `POST/DELETE /classes/:id/subjects`, `GET/POST/DELETE /subjects` |
| Students | `GET/POST /students`, `GET/PATCH /students/:id`, `POST/DELETE /students/:id/parents` |
| Attendance | `GET/POST /attendance`, `GET /attendance/student/:id` |
| Results | `GET/POST /scores`, `GET /results/broadsheet`, `GET /results/report/:studentId`, `POST /results/observations/:id`, `POST /results/remarks/:id` |
| Fees | `GET/POST /fees/items`, `GET /fees/statement/:studentId`, `POST /fees/payments`, `GET /fees/payments/:id/receipt`, `GET /fees/reports/collection`, `GET /fees/reports/debtors` |
| Notifications | `POST /fees/reminders`, `GET /email-log` |
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
