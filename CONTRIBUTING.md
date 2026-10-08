# Contributing to DynaShift AI

Welcome to the team. This document contains the rules every member must follow when working on this project. Following them keeps the codebase clean, prevents lost work, and makes collaboration smooth — especially during a hackathon where time is tight.

---

## 1. Always Work on a Separate Branch

Never commit directly to `main`. The `main` branch must always hold working, demo-ready code.

```bash
# Before starting any work, create a branch from the latest main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Name your branch clearly so teammates know what you are working on:

| Type | Example |
|---|---|
| New feature | `feature/genetic-algorithm-tuning` |
| Bug fix | `fix/conflict-detection-edge-case` |
| Documentation | `docs/update-readme` |
| Style / UI | `style/responsive-mobile-layout` |

---

## 2. Use Meaningful Commit Messages

A good commit message tells the reader **what** changed and **why**, not just "update file".

**Format:**
```
<type>: <short description in present tense>
```

**Examples — Good:**
```
feat: add equipment-failure disruption type to repair engine
fix: prevent negative demand values in surge disruption
docs: add file-by-file explanation to README
style: increase contrast on conflict cell highlight
```

**Examples — Bad:**
```
update
fixed stuff
wip
aaa
```

**Types to use:**
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes only
- `style:` — CSS or whitespace, no logic change
- `refactor:` — restructure without changing behaviour
- `test:` — adding or updating tests

---

## 3. Pull the Latest Main Before Starting Work

Stale code causes merge conflicts. Always sync with `main` first.

```bash
git checkout main
git pull origin main

# Then create or update your branch
git checkout -b feature/my-new-work
# or, if your branch already exists:
git checkout feature/my-existing-branch
git merge main
```

If there are conflicts after the merge, resolve them carefully — do not simply accept all yours or all theirs without reading both versions.

---

## 4. Do Not Overwrite Another Member's Work

- **Read `TEAM_WORK.md`** before you start to understand who owns which file.
- If you need to touch a file owned by another member, talk to them first.
- When in doubt, pull the latest main and check `git log <filename>` to see recent changes:
  ```bash
  git log --oneline styles.css
  ```
- Never use `git push --force` on a shared branch. It rewrites history and loses other people's commits.

---

## 5. Test the Application Before Pushing

This is a browser-only application — testing is quick.

Before pushing your branch:

1. Open `index.html` in a browser.
2. Click **Generate Synthetic Data** — verify employees and demand table appear.
3. Click **Run AI Scheduler** — verify the schedule grid renders without errors.
4. Click **Inject Disruption** at least twice using different disruption types.
5. Click **AI Repair Schedule** — verify the revised schedule and comparison view load.
6. Open the **Analytics** tab — verify all four charts render.
7. Open the browser console (F12 → Console) — there should be **no JavaScript errors**.

Only push when all of these steps pass.

---

## 6. Create a Pull Request Before Merging Into Main

No one merges their own work directly into `main`.

**Steps:**
1. Push your branch to GitHub:
   ```bash
   git push -u origin feature/your-feature-name
   ```
2. Open the repository on GitHub.
3. Click **Compare & pull request**.
4. Write a clear PR title and description:
   - What did you change?
   - Which files were affected?
   - Does it affect any other member's work?
5. Request a review from at least one other team member.
6. Address any review comments before merging.
7. After approval, use **Squash and merge** to keep the main branch history tidy.
8. Delete your branch after the merge.

---

## Quick Reference Checklist

Before every push, confirm:

- [ ] I am on a feature branch, not `main`
- [ ] I pulled the latest `main` before starting
- [ ] My commit messages are clear and follow the format
- [ ] I have not accidentally edited files owned by another member
- [ ] I opened `index.html` and tested the full demo flow
- [ ] The browser console shows no errors
- [ ] I have opened a Pull Request and requested a review

---

## Questions?

If you are unsure about anything, ask in the team group chat before making changes. It is always faster to ask than to fix a broken `main` branch during a demo.
