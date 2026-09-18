import { UrlMatchResult, UrlSegment } from '@angular/router';

/**
 * Matches both `<base>` and `<base>/<value>` with **one** route config, binding `<value>` to the
 * route param `name` when it is there (issue #187).
 *
 * Two sibling routes (`''` and `':itemId'`) pointing at the same component look equivalent but are
 * not: Angular's default `RouteReuseStrategy` reuses a component only while
 * `future.routeConfig === curr.routeConfig`, so sibling routes destroy and recreate the whole page
 * on every open/close of a detail view. Everything the page instance holds — the kit's
 * focus-restore-on-close, the list's search text, the intro card's collapsed state — is lost with
 * it. One route with this matcher makes opening and closing a detail view the same kind of
 * navigation as `/user/1` → `/user/2`: same config, same instance, a new param value that the
 * component reads through `withComponentInputBinding()` (`undefined` once the segment is gone).
 *
 * The URL shape is exactly the same as the sibling-route version, so a detail view is still a real
 * navigation: the phone's back gesture closes it, a reload reopens it, and it can be deep-linked.
 */
export function optionalParamMatcher(
  name: string,
): (segments: UrlSegment[]) => UrlMatchResult | null {
  return (segments) => {
    if (segments.length === 0) {
      return { consumed: [] };
    }
    if (segments.length === 1) {
      return { consumed: segments, posParams: { [name]: segments[0] } };
    }
    return null;
  };
}
