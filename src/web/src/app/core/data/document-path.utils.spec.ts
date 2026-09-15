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

    it('overwrites the final segment outright, whatever it held before', () => {
      const result = setAtPath({ shared: { roles: ['a', 'b'] } }, 'shared.roles', ['c']);
      expect(result).toEqual({ shared: { roles: ['c'] } });
    });

    it('throws instead of silently replacing an array found along the path', () => {
      const source = { shared: { roles: [{ id: '1', name: 'A' }] } };
      expect(() => setAtPath(source, 'shared.roles.0.name', 'Z')).toThrow(/is an array/);
      expect(source).toEqual({ shared: { roles: [{ id: '1', name: 'A' }] } });
    });

    it('throws instead of silently replacing a primitive found along the path', () => {
      const source = { profile: { name: 'Sam' } };
      expect(() => setAtPath(source, 'profile.name.first', 'X')).toThrow(/is a string/);
      expect(source).toEqual({ profile: { name: 'Sam' } });
    });

    it('rejects an empty path', () => {
      expect(() => setAtPath({}, '', 1)).toThrow(/must not be empty/);
    });
  });
});
