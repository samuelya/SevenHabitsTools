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

## Writing standard

Every string in the app follows this standard, in both languages. It sits on top of the content rule above: every prompt, hint and example is still our own paraphrase, never book text.

### English

- **One idea per sentence**, 15 words or fewer.
- **Talk to the user.** Use "you" and "your" and contractions (you'll, don't, what's).
- **Prompts are questions or short instructions.** "Why do you think they didn't wave back?", not "Reflection on the other person's motives".
- **Plain word first; the book's term once.** Use the everyday word everywhere. Give the book's term once per exercise, either in parentheses, as in "quick fix (technique)", or in a short sentence like "The book calls this a paradigm." After that, use only the plain word.
- **Buttons are 2 words or fewer**, verb first: "Mark done", "Reopen", "Next".
- **Hints say what to do next, never what the form does.** "Write your guess first, then see the other side.", not "The button is disabled until the field has text."
- **Examples and placeholders are concrete and ordinary:** a coworker, a teenager, an alarm clock. Start them with "e.g.".

### Arabic: the register split

Arabic uses two registers, split by what the string does. Nobody decides this string by string: the i18n key decides it (next section).

| Register | Used for |
|---|---|
| **فصحى** (Modern Standard Arabic) | buttons, tabs, field labels, step titles, legends, habit and chapter titles, status text, and the book's terms |
| **عامية مصرية** (Egyptian colloquial) | prompts, hints, intros, empty states, gate checklists, placeholders, examples and guides |

- فصحى strings are short and neutral: "اعرض الوجه الآخر", "ما تراه", "السابق".
- عامية strings talk to the user the way a friend would: "تفتكر ليه ما ردش عليك؟". Spell them the usual Egyptian way (مش, إيه, ليه, دلوقتي, عشان). Don't mix in فصحى grammar (لا يوجد, سوف) in the same sentence.
- **Book terms stay فصحى, even inside عامية prose.** Put them in «guillemets» the first time: الكتاب بيسمي العدسة دي «إطار ذهني».
- **Quoting a button or label inside prose:** copy its text exactly, in «», in its own register: دوس «اعرض الوجه الآخر».
- The `ar` string is a fresh translation of our `en` string, never text from an Arabic edition of the book (see "Phrasing prompts").

### Key-suffix boundary (Arabic register)

Look at the **last segment** of the key. It matches a suffix when it equals the suffix or has it as a final camelCase segment, optionally followed by digits: `attemptLabel` counts as `label`, `revealButton` as `button`, `currentLegend` as `legend`, `placeholder1` as `placeholder`.

| Key matches | Register |
|---|---|
| `label`, `title`, `stepLabel`, `stepTitle`, `legend`, `button`, `kind.*`, `status.*` | فصحى |
| `prompt`, `placeholder`, `hint`, `intro`, `text`, `whyItMatters`, `checklist.*`, `guide.*`, `empty*` | عامية |

Apply the rules in this order and stop at the first one that matches:

1. **Last-segment suffix** from the table (`step2.kind.prompt` is عامية, because it ends in `prompt`; `guide.examples[].fields[].label` is فصحى, because it repeats the field's label).
2. **Action keys count as `button`:** `close`, `back`, `next`, `markDone`, `reopen`, `save`, `delete`, `continue`. They are فصحى.
3. **Path prefix** from the table: `kind.*`, `status.*`, `checklist.*`, `guide.*` (`step2.kind.technique` is فصحى; `guide.afterwards` is عامية).
4. **Anything else:** if it names a thing, an option or a state (rating options, sort options, "Saved", aria labels), use فصحى. If the user reads it as a sentence or a story (scene text such as `step1.viewA`), use عامية.

**Adding a new key?** Pick a name that lands in the right row: a new hint ends in `Hint`, a new button in `Button`.

### Glossary

Use these words every time. The **English** column is the word the app uses. **فصحى** is for chrome (rows 1 and 3 of the boundary rules). **عامية** is for prose. When a book term appears in prose, it stays فصحى in «».

| Term | English in the app | فصحى (chrome, book term) | عامية (prose) | Notes |
|---|---|---|---|---|
| paradigm | "how you see it", "lens"; book term *paradigm* once | إطار ذهني | العدسة اللي بتبص منها; «إطار ذهني» once | Book term, always فصحى |
| script | "the pattern you learned at home"; book term *script* once | النص (book term), **owner to confirm** | العادة اللي أخدتها من بيتك | |
| asset | "something that gives you value" | مورد, **owner to confirm** | حاجة ليها قيمة عندك, **owner to confirm** | The issue has "مورد?" |
| over-used | Over-used | مُستخدَم أكثر من اللازم, **owner to confirm** | بتستخدمها زيادة عن اللزوم | Option label, so فصحى |
| balanced | Balanced | متوازن | متوازنة | |
| under-used | Under-used | مُستخدَم أقل من اللازم, **owner to confirm** | مش بتستخدمها كفاية | Option label, so فصحى |
| quick fix | Quick fix; book term *technique* once | حل سريع; book term «أسلوب» | حل سريع | Merged slice, `step2` |
| real change | Real change; book term *character* once | تغيير حقيقي; book term «شخصية» | تغيير حقيقي | Merged slice, `step2` |
| done (state) | Done | تم | تم | `doneToggle.itemDone` |
| mark done (button) | Mark done | تحديد كمكتمل, **owner to confirm** (now: وضع علامة تم) | دوس «<button text>» | Prose copies the button text exactly |
| reopen (button) | Reopen | إعادة فتح, **owner to confirm** | افتحه تاني | Issue: "decide". Button is فصحى by rule 2 |
| continue | Continue | متابعة, **owner to confirm** | كمّل | Issue: "decide". Button متابعة; prose كمّل, as in `guide.afterwards` |

### Worked examples (from the merged Paradigms slice)

**English**

- Prompt, `step1.firstView.prompt`: "Why do you think they didn't wave back?" This is a question in "you" form, 8 words, and asks for the user's own guess.
- Hint, `step1.revealHint`: "Write your guess first, then see the other side." It says what to do next, not that the button is locked.

**Arabic**

- Prompt, `step1.firstView.prompt` (عامية): "تفتكر ليه ما ردش عليك؟" This is colloquial because the key ends in `prompt`. Compare the فصحى label on the same field: `firstView.label` "تخمينك الأول".
- Hint, `step1.revealHint` (عامية): "اكتب تخمينك الأول، وبعدين هوريك الوش التاني." It sits next to the فصحى button `revealButton` "اعرض الوجه الآخر": same idea, two registers, and each one is chosen by its key.

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
- [ ] Arabic register split respected per the key-suffix rule in "Writing standard"; glossary words used.
