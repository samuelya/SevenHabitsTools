import { shouldShowSaveError } from './save-error-notifier.logic';

describe('shouldShowSaveError', () => {
  const doc = { v: 1 };

  it('shows for the first failure of a run', () => {
    expect(shouldShowSaveError({ open: false, acknowledged: null, current: doc })).toBe(true);
  });

  it('#128: does not show again for a retry of the document the user already closed it for', () => {
    expect(shouldShowSaveError({ open: false, acknowledged: doc, current: doc })).toBe(false);
  });

  it('#136: shows again when the failing document has edits made after the user closed it', () => {
    expect(shouldShowSaveError({ open: false, acknowledged: doc, current: { v: 2 } })).toBe(true);
  });

  it('never stacks a second snackbar while one is open', () => {
    expect(shouldShowSaveError({ open: true, acknowledged: null, current: doc })).toBe(false);
  });
});
