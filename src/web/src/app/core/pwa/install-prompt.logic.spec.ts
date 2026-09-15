import {
  INSTALL_PROMPT_SNOOZE_DAYS,
  isIosSafari,
  shouldShowInstallBanner,
} from './install-prompt.logic';

const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('shouldShowInstallBanner', () => {
  it('shows when never dismissed', () => {
    expect(shouldShowInstallBanner(null, NOW)).toBe(true);
  });

  it('hides right after a dismissal', () => {
    expect(shouldShowInstallBanner(NOW.toISOString(), NOW)).toBe(false);
  });

  it('hides one day before the snooze period elapses', () => {
    const dismissed = new Date(NOW.getTime() - (INSTALL_PROMPT_SNOOZE_DAYS - 1) * 86_400_000);
    expect(shouldShowInstallBanner(dismissed.toISOString(), NOW)).toBe(false);
  });

  it('shows again once the snooze period has fully elapsed', () => {
    const dismissed = new Date(NOW.getTime() - INSTALL_PROMPT_SNOOZE_DAYS * 86_400_000);
    expect(shouldShowInstallBanner(dismissed.toISOString(), NOW)).toBe(true);
  });

  it('treats an unparsable stored value as never dismissed', () => {
    expect(shouldShowInstallBanner('not a date', NOW)).toBe(true);
  });
});

describe('isIosSafari', () => {
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const IPAD_SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1';
  const DESKTOP_MAC_SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';

  it('recognises an iPhone running Safari', () => {
    expect(isIosSafari(IPHONE_SAFARI, 0)).toBe(true);
  });

  it('recognises an iPad running Safari (reports as Macintosh, but supports touch)', () => {
    expect(isIosSafari(IPAD_SAFARI, 5)).toBe(true);
  });

  it('does not treat a touch-capable real Mac UA without touch points as an iPad', () => {
    expect(isIosSafari(DESKTOP_MAC_SAFARI, 0)).toBe(false);
  });

  it('excludes Chrome on iOS, which cannot install a PWA there', () => {
    expect(isIosSafari(IPHONE_CHROME, 0)).toBe(false);
  });

  it('excludes Android Chrome', () => {
    expect(isIosSafari(ANDROID_CHROME, 0)).toBe(false);
  });
});
