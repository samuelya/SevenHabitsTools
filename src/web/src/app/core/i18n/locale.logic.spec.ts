import { intlLocaleFor, numberingSystemFor } from './locale.logic';

describe('numberingSystemFor', () => {
  it('maps "western" to the Latin numbering system', () => {
    expect(numberingSystemFor('western')).toBe('latn');
  });

  it('maps "arabic" to the Eastern Arabic-Indic numbering system', () => {
    expect(numberingSystemFor('arabic')).toBe('arab');
  });
});

describe('intlLocaleFor', () => {
  it('builds an Intl locale with the numbering system as a Unicode extension', () => {
    expect(intlLocaleFor('en', 'western')).toBe('en-u-nu-latn');
    expect(intlLocaleFor('ar', 'arabic')).toBe('ar-u-nu-arab');
  });
});
