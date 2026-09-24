import { ExerciseGuideContent } from '../shared/exercise-kit/exercise-guide/exercise-guide';
import maturityAr from './paradigms-maturity/i18n/ar.json';
import maturityEn from './paradigms-maturity/i18n/en.json';
import pcBalanceAr from './paradigms-pc-balance/i18n/ar.json';
import pcBalanceEn from './paradigms-pc-balance/i18n/en.json';
import perceptionAr from './paradigms-perception/i18n/ar.json';
import perceptionEn from './paradigms-perception/i18n/en.json';
import teachAr from './paradigms-teach/i18n/ar.json';
import teachEn from './paradigms-teach/i18n/en.json';
import transitionAr from './paradigms-transition/i18n/ar.json';
import transitionEn from './paradigms-transition/i18n/en.json';
import { teachSampleFromExample } from './paradigms-teach/teach.logic';
import { scriptFromExample } from './paradigms-transition/transition.logic';

/**
 * Every Paradigms exercise's "Read more" guide, loaded from its own i18n JSON (issue #231's
 * "Unit tests" AC): each `guide` object must be a valid `ExerciseGuideContent` at runtime, since a
 * JSON import only types `kind` as `string` and the dialog renders whatever it is given.
 */

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** Every problem with `value` as an `ExerciseGuideContent`; empty when it is one. */
function guideProblems(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null) return ['guide is not an object'];
  const guide = value as Record<string, unknown>;
  const extraKeys = Object.keys(guide).filter(
    (key) => !['inShort', 'howTo', 'examples', 'afterwards'].includes(key),
  );
  if (extraKeys.length) problems.push(`unknown keys: ${extraKeys.join(', ')}`);
  if (!isText(guide['inShort'])) problems.push('inShort is not text');
  if (!isText(guide['afterwards'])) problems.push('afterwards is not text');
  const howTo = guide['howTo'];
  if (!Array.isArray(howTo) || howTo.length === 0 || !howTo.every(isText)) {
    problems.push('howTo is not a non-empty list of text');
  }
  const examples = guide['examples'];
  if (!Array.isArray(examples) || examples.length === 0) {
    return [...problems, 'examples is not a non-empty list'];
  }
  examples.forEach((example: Record<string, unknown>, index) => {
    const at = `examples[${index}]`;
    const kind = example['kind'];
    if (kind !== undefined && kind !== 'fields' && kind !== 'card') problems.push(`${at}.kind`);
    const allowed = [
      'kind',
      'title',
      'fields',
      ...(kind === 'card' ? ['subtitle', 'done', 'sample'] : []),
    ];
    const extra = Object.keys(example).filter((key) => !allowed.includes(key));
    if (extra.length) problems.push(`${at} unknown keys: ${extra.join(', ')}`);
    if (!isText(example['title'])) problems.push(`${at}.title`);
    if ('subtitle' in example && !isText(example['subtitle'])) problems.push(`${at}.subtitle`);
    if ('done' in example && typeof example['done'] !== 'boolean') problems.push(`${at}.done`);
    const fields = example['fields'];
    if (!Array.isArray(fields) || fields.length === 0) {
      problems.push(`${at}.fields is not a non-empty list`);
      return;
    }
    fields.forEach((field: Record<string, unknown>, fieldIndex) => {
      const keys = Object.keys(field).sort().join(',');
      if (keys !== 'label,value' || !isText(field['label']) || !isText(field['value'])) {
        problems.push(`${at}.fields[${fieldIndex}]`);
      }
    });
  });
  return problems;
}

interface Scope {
  readonly form?: Readonly<Record<string, unknown>>;
  readonly areas?: Readonly<Record<string, unknown>>;
  readonly guide?: unknown;
}

const EXERCISES: readonly {
  readonly id: string;
  readonly en: Scope;
  readonly ar: Scope;
  /** The in-form placeholders the guide's example must show word for word (#231 AC). */
  readonly placeholders: readonly (readonly [section: 'form' | 'areas', key: string])[];
  /** A list exercise's parser for a card example's "Try this example" payload (issue #232), and
   * the example text its stored key idea or pattern must repeat; absent for worksheets and
   * assessments, which must not offer the button. */
  readonly sample?: {
    readonly parse: (value: unknown) => object | null;
    readonly shownAs: (example: { title: string; subtitle?: string }) => string | undefined;
    readonly stored: (parsed: object) => string | undefined;
  };
}[] = [
  { id: 'paradigms-perception', en: perceptionEn, ar: perceptionAr, placeholders: [] },
  {
    id: 'paradigms-transition',
    en: transitionEn,
    ar: transitionAr,
    sample: {
      parse: scriptFromExample,
      shownAs: (example) => example.title,
      stored: (parsed) => (parsed as { text?: string }).text,
    },
    placeholders: [
      ['form', 'textPlaceholder'],
      ['form', 'newScriptPlaceholder'],
      ['form', 'situationPlaceholder'],
    ],
  },
  {
    id: 'paradigms-pc-balance',
    en: pcBalanceEn,
    ar: pcBalanceAr,
    placeholders: [
      ['form', 'physicalAssetPlaceholder'],
      ['form', 'financialAssetPlaceholder'],
      ['form', 'humanAssetPlaceholder'],
      ['form', 'actionPlaceholder'],
      ['form', 'reflectionPlaceholder'],
    ],
  },
  {
    id: 'paradigms-maturity',
    en: maturityEn,
    ar: maturityAr,
    placeholders: [
      ['form', 'notePlaceholder'],
      ['areas', 'customPlaceholder'],
    ],
  },
  {
    id: 'paradigms-teach',
    en: teachEn,
    ar: teachAr,
    sample: {
      parse: teachSampleFromExample,
      shownAs: (example) => example.subtitle,
      stored: (parsed) => (parsed as { fields: { keyIdea?: string } }).fields.keyIdea,
    },
    placeholders: [
      ['form', 'keyIdeaPlaceholder'],
      ['form', 'personPlaceholder'],
      ['form', 'learnedPlaceholder'],
    ],
  },
];

/** Every string an example shows: titles, subtitles, field labels and values. */
function exampleTexts(guide: ExerciseGuideContent): string[] {
  return guide.examples.flatMap((example) => [
    example.title,
    ...(example.kind === 'card' && example.subtitle ? [example.subtitle] : []),
    ...example.fields.flatMap((field) => [field.label, field.value]),
  ]);
}

/** A placeholder without its "e.g. " / "مثلاً: " lead-in — the words the example repeats. */
const placeholderWords = (placeholder: string): string =>
  placeholder.replace(/^(e\.g\. |مثلاً: )/, '');

describe('Paradigms exercise guides (i18n JSON)', () => {
  for (const exercise of EXERCISES) {
    for (const lang of ['en', 'ar'] as const) {
      it(`${exercise.id} ${lang}: guide is a valid ExerciseGuideContent`, () => {
        expect(guideProblems(exercise[lang].guide)).toEqual([]);
      });

      it(`${exercise.id} ${lang}: "Try this example" only on a list exercise, with a valid sample`, () => {
        const examples = (exercise[lang].guide as ExerciseGuideContent).examples;
        const samples = examples.map((example) =>
          example.kind === 'card' ? example.sample : undefined,
        );
        const sample = exercise.sample;
        if (!sample) {
          expect(samples.every((value) => value === undefined)).toBe(true);
          return;
        }
        examples.forEach((example, index) => {
          const parsed = sample.parse(samples[index]);
          expect(parsed).not.toBeNull();
          expect(sample.stored(parsed as object)).toBe(
            sample.shownAs(example as { title: string; subtitle?: string }),
          );
        });
      });

      for (const [section, key] of exercise.placeholders) {
        it(`${exercise.id} ${lang}: ${section}.${key} matches the guide example`, () => {
          const placeholder = exercise[lang][section]?.[key];
          expect(typeof placeholder).toBe('string');
          const words = placeholderWords(placeholder as string);
          const texts = exampleTexts(exercise[lang].guide as ExerciseGuideContent);
          expect(texts.some((text) => text.includes(words))).toBe(true);
        });
      }
    }

    it(`${exercise.id}: en and ar guides have the same shape`, () => {
      const shape = (guide: ExerciseGuideContent) => ({
        howTo: guide.howTo.length,
        examples: guide.examples.map((example) => ({
          kind: example.kind ?? 'fields',
          done: example.kind === 'card' ? example.done : undefined,
          subtitle: example.kind === 'card' && example.subtitle !== undefined,
          fields: example.fields.length,
          // The stored enum keys (not the translated text) must match across languages.
          sample:
            example.kind === 'card' && example.sample
              ? Object.fromEntries(
                  Object.entries(example.sample).filter(
                    ([key]) =>
                      !['text', 'newScript', 'situation', 'keyIdea', 'person', 'learned'].includes(
                        key,
                      ),
                  ),
                )
              : undefined,
        })),
      });
      expect(shape(exercise.ar.guide as ExerciseGuideContent)).toEqual(
        shape(exercise.en.guide as ExerciseGuideContent),
      );
    });
  }
});
