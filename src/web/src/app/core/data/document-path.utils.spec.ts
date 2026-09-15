import { getAtPath, setAtPath } from './document-path.utils';

describe('document-path.utils', () => {
  describe('getAtPath', () => {
    it('reads a nested value', () => {
      const source = { habits: { h2: { mission: { statement: 'Be the change' } } } };
      expect(getAtPath<string>(source, 'habits.h2.mission.statement')).toBe('Be the change');
    });

    it('returns undefined when a segment is missing', () => {
      expect(getAtPath(1, 'habits.h2')).toBeUndefined();
      expect(getAtPath({ habits: {} }, 'habits.h2.mission')).toBeUndefined();
    });
  });

  describe('setAtPath', () => {
    it('sets a nested value, creating missing intermediate objects', () => {
      const source = { habits: {} };
      const result = setAtPath(source, 'habits.h2.mission', { statement: 'Be the change' });

      expect(result).toEqual({ habits: { h2: { mission: { statement: 'Be the change' } } } });
      expect(source).toEqual({ habits: {} });
    });

    it('does not mutate the original and shares unrelated branches by reference', () => {
      const shared = { roles: ['parent'] };
      const source = { habits: { h1: { proactivity: 1 } }, shared };

      const result = setAtPath(source, 'habits.h1.proactivity', 2);

      expect(source.habits.h1.proactivity).toBe(1);
      expect(result.habits.h1.proactivity).toBe(2);
      expect(result.shared).toBe(shared);
    });

    it('replaces a non-object value found along the path instead of throwing', () => {
      const result = setAtPath({ habits: { h2: 'not an object yet' } }, 'habits.h2.mission', {});
      expect(result).toEqual({ habits: { h2: { mission: {} } } });
    });

    it('rejects an empty path', () => {
      expect(() => setAtPath({}, '', 1)).toThrow(/must not be empty/);
    });
  });
});
