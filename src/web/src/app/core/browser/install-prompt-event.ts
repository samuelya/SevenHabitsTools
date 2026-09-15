/** The (non-standard, Chromium-only) `beforeinstallprompt` event. Not in the DOM lib types, so
 * `InstallPromptService` narrows to this shape instead of `any`. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}
