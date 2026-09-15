import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import { habitTitle } from './habits.routes';

function routeWithHabit(habit: string | null): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap(habit === null ? {} : { habit }) } as ActivatedRouteSnapshot;
}

describe('habitTitle', () => {
  it("resolves a root/shell-scope 'titles.<id>' key for a known habit id", () => {
    expect(habitTitle(routeWithHabit('h1'), {} as never)).toBe('titles.h1');
    expect(habitTitle(routeWithHabit('paradigms'), {} as never)).toBe('titles.paradigms');
    expect(habitTitle(routeWithHabit('interdependence'), {} as never)).toBe(
      'titles.interdependence',
    );
  });

  it('resolves to an empty string for an unknown or missing habit id', () => {
    expect(habitTitle(routeWithHabit('not-a-habit'), {} as never)).toBe('');
    expect(habitTitle(routeWithHabit(null), {} as never)).toBe('');
  });
});
