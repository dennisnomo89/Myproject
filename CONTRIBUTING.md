# Contributing

Each member's Git history is reviewed to assess individual contribution, so follow these rules.

## One-time setup (each member)

```bash
git config --global user.name "Your Full Name"
git config --global user.email "the-email-on-your-github-account@example.com"
git clone https://github.com/<your-org-or-username>/school-management-system.git
```

Your commit email must match an email on your GitHub account, or your commits will not count towards your profile.

## Workflow

1. Get the latest code: `git checkout main && git pull`
2. Create a branch for your task: `git checkout -b feature/attendance-module`
3. Commit small, focused changes often:
   `git add .` then `git commit -m "Add daily attendance form for teachers"`
4. Push your branch: `git push -u origin feature/attendance-module`
5. Open a Pull Request on GitHub and ask another member to review it. Wait for the automatic checks (CI) to show ✓. Before pushing, you can run the same tests yourself with `cd server && npm test`.
6. After approval, merge into `main` and delete the branch.

## Branch names

- `feature/<name>`: new functionality (e.g. `feature/fee-invoices`)
- `fix/<name>`: bug fixes
- `docs/<name>`: documentation, diagrams, SRS updates

## Commit messages

Write in the imperative and say what changed: `Add parent dashboard`, `Fix grade calculation for CA scores`. Avoid `update`, `changes` or `final`.

## Rules

- Never commit `.env` files, passwords or database dumps containing real pupil data.
- Do not push directly to `main`; use pull requests.
- Do not upload work on behalf of another member: they must commit it themselves.
