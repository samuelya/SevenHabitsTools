import {
  allMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from './done-checklist.logic';

const KEYS = ['a', 'b', 'c'] as const;
type Key = (typeof KEYS)[number];
type Item = Readonly<Record<Key, boolean>>;

const metOf = (item: Item) => item;

describe('done-checklist.logic', () => {
  describe('closestMet', () => {
    it('is all-unmet with no items', () => {
      expect(closestMet<Item, Key>([], KEYS, metOf)).toEqual({ a: false, b: false, c: false });
    });

    it('picks the item meeting the most keys', () => {
      const items: Item[] = [
        { a: true, b: false, c: false },
        { a: true, b: true, c: false },
      ];
      expect(closestMet(items, KEYS, metOf)).toBe(items[1]);
    });

    it('keeps the earliest item on a tie', () => {
      const items: Item[] = [
        { a: true, b: false, c: false },
        { a: false, b: true, c: false },
      ];
      expect(closestMet(items, KEYS, metOf)).toBe(items[0]);
    });

    it('is all-met exactly when some item meets every key', () => {
      const items: Item[] = [
        { a: true, b: true, c: false },
        { a: true, b: true, c: true },
      ];
      expect(allMet(KEYS, closestMet(items, KEYS, metOf))).toBe(true);
      expect(allMet(KEYS, closestMet(items.slice(0, 1), KEYS, metOf))).toBe(false);
    });
  });

  it('checklistItems pairs labels with met, in key order', () => {
    expect(
      checklistItems(KEYS, { a: true, b: false, c: true }, { a: 'A', b: 'B', c: 'C' }),
    ).toEqual([
      { label: 'A', met: true },
      { label: 'B', met: false },
      { label: 'C', met: true },
    ]);
  });

  describe('checklistLabels / labelsLoaded', () => {
    it("falls back to '' per key for translateSignal's before-load [''] shape", () => {
      const labels = checklistLabels(KEYS, ['']);
      expect(labels).toEqual({ a: '', b: '', c: '' });
      expect(labelsLoaded(KEYS, labels)).toBe(false);
    });

    it('is loaded once real text arrives', () => {
      const labels = checklistLabels(KEYS, ['A', 'B', 'C']);
      expect(labels).toEqual({ a: 'A', b: 'B', c: 'C' });
      expect(labelsLoaded(KEYS, labels)).toBe(true);
    });
  });
});
