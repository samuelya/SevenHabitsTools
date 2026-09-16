/**
 * `DocumentPersistence.saveError`'s value when the write lock was taken over by another tab while
 * there were still unsaved edits (#143), rather than an `adapter.save()` rejection. `SaveErrorNotifier`
 * checks for this type to show a message that explains what happened instead of a generic save
 * failure.
 */
export class StrandedEditsError extends Error {
  constructor() {
    super('The write lock was taken over by another tab while there were unsaved edits.');
    this.name = 'StrandedEditsError';
  }
}
