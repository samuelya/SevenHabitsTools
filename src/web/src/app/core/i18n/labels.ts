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
};

@Injectable({ providedIn: 'root' })
export class Labels {
  /** Returns the label for `key`, or the key itself when it is unknown. */
  text(key: string): string {
    return EN[key] ?? key;
  }
}
