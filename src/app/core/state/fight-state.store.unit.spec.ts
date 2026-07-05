import {FightDomainService} from '../domain/fight-domain.service';
import {FightStateStore} from './fight-state.store';
import {SessionStore} from './session.store';

describe('FightStateStore', () => {
  function buildStore() {
    const sessionStore = new SessionStore();
    sessionStore.setSession(true, 'player1');
    return new FightStateStore(new FightDomainService(), sessionStore);
  }

  it('resolves local summoner level from user stats', () => {
    const store = buildStore();
    store.setRoster([
      {login: 'player1', stats: {level: 9}, character: {animalRace: 'bugurt'}} as any
    ], [], [], [], undefined);

    expect(store.resolveLocalSummonerLevel()).toBe(9);
  });

  it('resolves local summoner level from character payload when stats are missing', () => {
    const store = buildStore();
    store.setRoster([
      {login: 'player1', character: {animalRace: 'bugurt', level: 10}} as any
    ], [], [], [], undefined);

    expect(store.resolveLocalSummonerLevel()).toBe(10);
  });

  it('resolves local summoner level from nested stats payload', () => {
    const store = buildStore();
    store.setRoster([
      {
        login: 'player1',
        character: {animalRace: 'bugurt', user: {stats: {level: 10}}}
      } as any
    ], [], [], [], undefined);

    expect(store.resolveLocalSummonerLevel()).toBe(10);
  });
});
