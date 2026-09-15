# Content rule

Seven Habits Tools is an independent personal tool built by one user for their own practice. It is
**not affiliated with, endorsed by or licensed by FranklinCovey** or the publisher of *The 7 Habits
of Highly Effective People* by Stephen R. Covey. Reading the book is the best way to get the most
out of the exercises in this app; this rule keeps the app that way while still being useful without
reproducing the book.

This rule applies to every exercise prompt, help text, example, commit message, issue and PR
description, and UI string in the app (`en` and `ar`).

## Rules

1. **Original paraphrases only.** Every exercise prompt, instruction and example is written in our
   own words. Do not copy or closely rewrite sentences from the book.
2. **No book text beyond short titles or terms.** Naming a concept the book uses is fine — e.g.
   "Circle of Influence", "Quadrant II", "Emotional Bank Account" — but never quote a sentence or
   paragraph, and never reproduce a table, diagram or worksheet from the book.
3. **Reference chapters, not quotes.** When an exercise needs to point back to the book, cite the
   habit or chapter (e.g. "see Habit 3") instead of quoting page text.
4. **No FranklinCovey trademarks in branding.** App name, icons and marketing copy do not use
   FranklinCovey names, logos or trademarked program names beyond the habit titles themselves.
5. **The "not affiliated" note stays visible.** It appears in `README.md` and on the in-app
   `/about` page; do not remove or water it down.

## Phrasing prompts (`en` and `ar`)

- Write the `en` string first as a short, direct instruction or question in the user's voice (e.g.
  "What is one thing you can do this week that is important but not urgent?"), not as book prose.
- The `ar` translation is a fresh translation of the `en` prompt, not a translation of the book —
  translate our paraphrase, never source text from an Arabic edition of the book.
- Keep prompts habit-neutral in tone: plain, encouraging, and specific enough to act on.

## The `documents/` reference folder

`documents/` (repo root) holds a private local copy of the book, kept only so contributors can
check a paraphrase against the source chapter. It is listed in `.gitignore` and must **never** be
committed, uploaded, attached to an issue or PR, or quoted anywhere in issues, code, commit
messages or UI text.

## Reviewer checklist (every feature PR touching exercise content)

- [ ] No sentence or paragraph from the book appears in code, strings or the PR description.
- [ ] Only short titles/terms are used, not full quotes.
- [ ] Chapter/habit references are used instead of page quotes where the book is cited.
- [ ] No content from `documents/` was pasted into the issue, PR or commit.
- [ ] The "not affiliated" note is unchanged (or improved) in `README.md` and `/about`.
