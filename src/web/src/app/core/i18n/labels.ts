import { Injectable } from '@angular/core';

/**
 * English shell labels keyed like the future Transloco keys.
 * Placeholder until i18n lands (#28); components only depend on `Labels.text(key)`.
 */
const EN: Readonly<Record<string, string>> = {
  'app.name': 'Seven Habits Tools',
  'nav.main': 'Main navigation',
  'nav.back': 'Back',
  'nav.home': 'Home',
  'nav.habits': 'Habits',
  'nav.plan': 'Plan',
  'nav.journal': 'Journal',
  'nav.settings': 'Settings',
  'nav.about': 'About',
  'nav.github': 'GitHub',
  // Accessible name for the GitHub row/link: states that it opens in a new tab since the visible
  // label ("nav.github") and icon alone don't convey that to assistive tech.
  'nav.githubExternalLabel': 'GitHub, opens in a new tab',
  'home.welcome': 'Work through every exercise of the seven habits, at your own pace.',
  'home.browseHabits': 'Browse habits',
  'habits.intro': 'Pick a habit to see its exercises.',
  'habits.paradigms.title': 'Paradigms and principles',
  'habits.h1.title': 'Habit 1: Be proactive',
  'habits.h2.title': 'Habit 2: Begin with the end in mind',
  'habits.h3.title': 'Habit 3: Put first things first',
  'habits.h4.title': 'Habit 4: Think win-win',
  'habits.h5.title': 'Habit 5: Seek first to understand, then to be understood',
  'habits.h6.title': 'Habit 6: Synergize',
  'habits.h7.title': 'Habit 7: Sharpen the saw',
  'habits.interdependence.title': 'Paradigms of interdependence',
  'placeholder.comingSoon': 'Coming soon.',
  'hub.noExercises': 'Exercises for this habit are coming soon.',
  'data.migration.schemaTooNew': 'This file was saved by a newer version of the app.',
  'about.title': 'About',
  'about.notAffiliated':
    'Seven Habits Tools is an independent personal tool. It is not affiliated with, endorsed ' +
    'by or licensed by FranklinCovey or the publisher of The 7 Habits of Highly Effective ' +
    'People.',
  'about.recommendation':
    'This app is a practice companion, not a replacement — reading Stephen R. Covey’s book ' +
    'is the best way to get the most from these exercises.',
  'about.versionLabel': 'Version',
  'about.versionUnknown': 'unknown',
  'about.privacyLink': 'Privacy note',
  'settings.privacyTitle': 'Privacy',
  'settings.privacyNote':
    'Your data stays in this browser. Nothing is uploaded or shared unless you choose to ' +
    'export it.',
  'data.bootstrap.corrupt': 'The saved file is damaged or in a format this app cannot read.',
  'data.error.title': "We couldn't read your saved data",
  'data.error.retry': 'Try again',
  'data.error.exportRaw': 'Export raw file',
  'data.error.importBackup': 'Import a backup',
  'data.error.reset': 'Start fresh',
  'data.error.resetConfirm':
    'This will permanently delete the saved data on this device. This cannot be undone.',
  'data.error.cancel': 'Cancel',
  'data.error.confirmReset': 'Yes, start fresh',
  'data.readOnly.banner':
    'Read-only — another tab is editing this data. This tab will refresh once that tab closes.',
  'data.saveError.message': "We couldn't save your latest changes.",
  'data.saveError.exportNow': 'Export now',
  'data.readOnly.editRefused':
    "This tab is read-only, so that change wasn't made. Edit in the other tab, or close it to " +
    'edit here.',
  'data.readOnly.editPending': 'Still getting ready to save. Try that change again in a moment.',
  'data.snackbar.dismiss': 'Dismiss',
  'settings.storage.title': 'Storage',
  'settings.storage.persisted': 'Your data is protected from automatic clearing by the browser.',
  'settings.storage.notPersisted':
    'The browser may clear this data under storage pressure. Export a backup from time to time.',
  'settings.storage.unknown': 'Storage persistence status is not available in this browser.',
  'settings.storage.usageLabel': 'Used',
  'data.pwa.offline': "You're offline. Your changes stay saved on this device.",
  'data.pwa.updateAvailable': 'A new version of this app is available.',
  'data.pwa.updateRequired': 'This app needs to reload to keep working.',
  'data.pwa.reload': 'Reload',
  'data.pwa.install.message': 'Install Seven Habits Tools for quick, offline access.',
  'data.pwa.install.action': 'Install',
  'data.pwa.install.iosHint': 'Install this app: tap the Share icon, then "Add to Home Screen".',
  'settings.backup.title': 'Backup',
  'settings.backup.export': 'Export data',
  'settings.backup.exportHint': 'Downloads a JSON file with everything saved on this device.',
  'settings.backup.exportedSnackbar': 'Exported {filename}.',
  'settings.backup.share': 'Share…',
  'settings.backup.sharedSnackbar': 'Shared.',
  'settings.backup.import': 'Import data',
  'settings.backup.importHint': 'Restores data from a previously exported JSON file.',
  'settings.backup.importReadOnly':
    "This tab is read-only, so it can't import. Import from the tab that isn't showing the " +
    'read-only banner, or close it.',
  'settings.backup.reminderLabel': 'Remind me to export data',
  'settings.backup.reminderOff': 'Never',
  'settings.backup.reminderDaily': 'Every day',
  'settings.backup.reminderWeekly': 'Every week',
  'settings.backup.reminderMonthly': 'Every month',
  'data.import.errors.notJson': "That file isn't a JSON file this app can read.",
  'data.import.errors.invalid': "That file's data isn't in a shape this app recognizes.",
  'data.import.dialogLoadError':
    "Couldn't load the import dialog. Check your connection and try again.",
  'data.import.title': 'Import this file?',
  'data.import.currentUpdatedAt': 'Your current data was last edited',
  'data.import.fileUpdatedAt': 'The file was last edited',
  'data.import.exportFirst': 'Export current data first',
  'data.import.replace': 'Replace…',
  'data.import.replaceHint': 'Discards everything currently on this device.',
  'data.import.replaceConfirm':
    'This will permanently replace all data on this device with the imported file. This cannot ' +
    'be undone.',
  'data.import.confirmReplace': 'Yes, replace',
  'data.import.cancel': 'Cancel',
  'data.import.importedSnackbar': 'Import complete.',
  'data.import.noPreviewCounts': 'This file has no feature data to preview yet.',
  'data.export.reminder':
    "You've made changes since your last export. Back up your data from time to time.",
};

@Injectable({ providedIn: 'root' })
export class Labels {
  /** Returns the label for `key`, or the key itself when it is unknown. `params`, if given,
   * fills in `{name}` placeholders (e.g. `settings.backup.exportedSnackbar`) — the same
   * `{name}` syntax Transloco's own `translate(key, params)` uses, so a label that needs one
   * doesn't have to change shape again once #28 migrates it. */
  text(key: string, params?: Readonly<Record<string, string | number>>): string {
    const label = EN[key] ?? key;
    if (!params) {
      return label;
    }
    return label.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }
}
