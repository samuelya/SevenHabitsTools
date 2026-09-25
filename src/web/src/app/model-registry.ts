/**
 * Side-effect imports: every feature's `<feature>.model.ts` calls `registerModel()`
 * (`core/data/registry.ts`) once, at module load (architecture issue #1 §6). Importing a model
 * file elsewhere only for its types is not guaranteed to run that side effect — a type-only import
 * can be elided by the build — so `app.config.ts` imports this file instead, once, before the
 * document bootstraps. One line per feature; add here when a feature gains a `<feature>.model.ts`.
 */
import './features/settings/settings.model';
import './features/paradigms-transition/transition.model';
import './features/paradigms-pc-balance/pc-balance.model';
import './features/paradigms-maturity/maturity.model';
import './features/paradigms-teach/teach.model';
import './features/paradigms-perception/perception.model';
import './features/h1-commitments/commitments.model';
import './shared/exercise-kit/exercise-kit.model';
// Shared entities (`shared.*`): registered here, eagerly, not by the features that use them.
import './shared/commitments/commitments.model';
