/** How long an install banner dismissal is remembered before it can show again. */
export const INSTALL_PROMPT_SNOOZE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether the install banner may show, given when it was last dismissed. Never shows again within
 * `INSTALL_PROMPT_SNOOZE_DAYS` of a dismissal (#27's "never nag"); an unparsable stored value is
 * treated the same as never dismissed rather than blocking the banner forever.
 */
export function shouldShowInstallBanner(dismissedAt: string | null, now: Date): boolean {
  if (dismissedAt === null) {
    return true;
  }
  const dismissed = new Date(dismissedAt).getTime();
  if (Number.isNaN(dismissed)) {
    return true;
  }
  return (now.getTime() - dismissed) / MS_PER_DAY >= INSTALL_PROMPT_SNOOZE_DAYS;
}

/**
 * Whether to show the iOS "Add to Home Screen" hint: Mobile Safari never fires
 * `beforeinstallprompt`, so it needs a manual instruction instead of the native prompt. `iPadOS`
 * reports as `Macintosh` in its user agent but, unlike a real Mac, supports touch — `maxTouchPoints`
 * tells them apart. Chrome/Firefox/Edge on iOS all use Apple's WebKit and identify themselves in
 * the user agent (`CriOS`, `FxiOS`, `EdgiOS`); the hint only applies to Safari itself, since those
 * others can't install a PWA on iOS at all.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const isIPhoneOrIPod = /iphone|ipod/i.test(userAgent);
  const isIPad = /ipad/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const isOtherIosBrowser = /crios|fxios|edgios/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !isOtherIosBrowser;
  return (isIPhoneOrIPod || isIPad) && isSafari;
}
