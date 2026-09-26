import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The app's own translation files, read at test time so a spec asserts on whatever copy ships
 * instead of a literal that goes stale on the next rewrite (issue #228). Prefer a test id or a
 * role; use `t()` where the visible text itself is what the test checks.
 */
export type Locale = 'en' | 'ar';

/** Transloco scope → its folder, relative to `src/web`. `root` is the global scope. */
const SCOPES = {
  root: 'public/assets/i18n',
  habits: 'src/app/features/habits/i18n',
  home: 'src/app/features/home/i18n',
  settings: 'src/app/features/settings/i18n',
  exerciseKit: 'src/app/shared/exercise-kit/i18n',
  paradigmsTransition: 'src/app/features/paradigms-transition/i18n',
  paradigmsPcBalance: 'src/app/features/paradigms-pc-balance/i18n',
  paradigmsMaturity: 'src/app/features/paradigms-maturity/i18n',
  paradigmsTeach: 'src/app/features/paradigms-teach/i18n',
  paradigmsPerception: 'src/app/features/paradigms-perception/i18n',
  h1Commitments: 'src/app/features/h1-commitments/i18n',
  h2Roles: 'src/app/features/h2-roles/i18n',
  h1Circle: 'src/app/features/h1-circle/i18n',
  h1Rehearsal: 'src/app/features/h1-rehearsal/i18n',
  h1Challenge: 'src/app/features/h1-challenge/i18n',
  h1Language: 'src/app/features/h1-language/i18n',
} as const;

export type Scope = keyof typeof SCOPES;

const WEB_ROOT = join(__dirname, '..');
const cache = new Map<string, unknown>();

function translations(locale: Locale, scope: Scope): unknown {
  const file = join(WEB_ROOT, SCOPES[scope], `${locale}.json`);
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(file, 'utf8')));
  return cache.get(file);
}

/** The translated string at `key` (dotted path), with `{{param}}` placeholders filled in. */
export function t(
  locale: Locale,
  scope: Scope,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      translations(locale, scope),
    );
  if (typeof value !== 'string') throw new Error(`No ${locale} string at ${scope}:${key}`);
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{{${name}}}`,
  );
}
