import { WriterRoleState } from './writer-role-state';

describe('WriterRoleState', () => {
  it('starts pending and not the writer', () => {
    const state = new WriterRoleState();

    expect(state.role()).toBe('pending');
    expect(state.isWriter()).toBe(false);
    expect(state.promoted()).toBe(false);
  });

  it('pending → writer is an initial grant, not a promotion', () => {
    const state = new WriterRoleState();

    state.grant();

    expect(state.isWriter()).toBe(true);
    expect(state.promoted()).toBe(false);
  });

  it('pending → reader → writer is a promotion', () => {
    const state = new WriterRoleState();

    state.deny();
    expect(state.role()).toBe('reader');
    state.grant();

    expect(state.isWriter()).toBe(true);
    expect(state.promoted()).toBe(true);
  });

  it('keeps promoted latched after a later reset', () => {
    const state = new WriterRoleState();
    state.deny();
    state.grant();

    state.reset();

    expect(state.role()).toBe('pending');
    expect(state.promoted()).toBe(true);
  });
});
