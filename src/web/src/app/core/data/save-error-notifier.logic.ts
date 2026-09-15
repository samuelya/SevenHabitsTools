/** What `SaveErrorNotifier` knows when a save has just failed. */
export interface SaveFailureContext<D> {
  /** Whether the save-error snackbar is currently on screen. */
  readonly open: boolean;
  /** The document the user was shown the snackbar for when they last closed it (Dismiss or
   * Export now) during this run of failures; `null` if they haven't closed one yet. */
  readonly acknowledged: D | null;
  /** The document that is failing to save now. */
  readonly current: D;
}

/**
 * Whether a failed save should (re)open the save-error snackbar: the first failure of a run always
 * does; after the user closed it, only a failure for a document with edits made since then does
 * (#136). A retry of the same unsaved document never does (#128), and neither does anything while
 * the snackbar is already showing.
 */
export function shouldShowSaveError<D>({
  open,
  acknowledged,
  current,
}: SaveFailureContext<D>): boolean {
  return !open && current !== acknowledged;
}
