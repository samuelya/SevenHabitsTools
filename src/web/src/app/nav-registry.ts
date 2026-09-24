import { registerNavFeature } from './core/layout/nav-items';

/**
 * Side-effect only: one line per shipped main-nav destination (`core/layout/nav-items.ts`),
 * imported once by `app.config.ts`. Plan (Dashboard, #97) and Journal (#99) add their line here
 * when they ship; until then their routes resolve for deep links but stay out of the nav (#221).
 */
registerNavFeature('/');
registerNavFeature('/habits');
registerNavFeature('/settings');
