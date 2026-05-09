import {SessionStore} from './session.store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it('sets and exposes login state', () => {
    store.setSession(true, 'naruto');

    expect(store.loggedIn()).toBeTrue();
    expect(store.username()).toBe('naruto');
  });

  it('clears session state', () => {
    store.setSession(true, 'sasuke');
    store.clearSession();

    expect(store.loggedIn()).toBeFalse();
    expect(store.username()).toBe('');
  });
});
