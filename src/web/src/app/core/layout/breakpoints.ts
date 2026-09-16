/**
 * Below this width the shell uses bottom navigation instead of the side navigation
 * (`Shell.handset`); the exercise kit's own responsive components (`GuidedStepper`,
 * `ExerciseDetail`) use the same breakpoint so a step-by-step exercise page reads consistently
 * with the rest of the app. Kept in its own file, not `shell.ts`, so importing it doesn't pull
 * `Shell`'s own (much heavier) Material imports into whatever imports the breakpoint alone — a
 * lazy-loaded feature that only needs the breakpoint would otherwise force a bundler-level shared
 * chunk between it and the eager shell, growing the initial bundle (issue #30 caught this).
 */
export const HANDSET_QUERY = '(max-width: 599.98px)';
