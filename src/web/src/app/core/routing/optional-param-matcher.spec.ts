import { UrlSegment } from '@angular/router';
import { optionalParamMatcher } from './optional-param-matcher';

function segments(...paths: string[]): UrlSegment[] {
  return paths.map((path) => new UrlSegment(path, {}));
}

describe('optionalParamMatcher', () => {
  const match = optionalParamMatcher('itemId');

  it('matches the bare base path without consuming a segment or binding the param', () => {
    expect(match(segments())).toEqual({ consumed: [] });
  });

  it('matches one trailing segment and binds it to the named param', () => {
    const url = segments('script-1');

    expect(match(url)).toEqual({ consumed: url, posParams: { itemId: url[0] } });
  });

  it('does not match more than one trailing segment', () => {
    expect(match(segments('script-1', 'extra'))).toBeNull();
  });
});
