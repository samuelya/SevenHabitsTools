import { inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Labels } from '../i18n/labels';

/**
 * Routes set `title` to a label key (or a resolver returning one). The key drives the
 * top app bar title and the document title.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly labels = inject(Labels);
  private readonly key = signal('');

  /** Label key of the current page title; empty when the route has none. */
  readonly titleKey = this.key.asReadonly();

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot) ?? '';
    this.key.set(key);
    const appName = this.labels.text('app.name');
    this.title.setTitle(key ? `${this.labels.text(key)} | ${appName}` : appName);
  }
}
