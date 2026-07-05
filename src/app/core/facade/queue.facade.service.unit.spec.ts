import {of} from 'rxjs';
import {QueueFacadeService} from './queue.facade.service';
import {AreaService} from '../../services/area/area.service';
import {CookieService} from 'ngx-cookie-service';
import {FightService} from '../../services/fight/fight.service';
import {LobbyApiService} from '../api/lobby-api.service';
import {Router} from '@angular/router';
import {TranslatePipe} from '../../services/translate.pipe';

describe('QueueFacadeService', () => {
  function buildFacade(lobbyUuids: string[]) {
    let createCallCount = 0;
    const router = {url: '/queue', navigateByUrl: () => Promise.resolve(true)} as unknown as Router;
    const lobbyApi = {
      getReadyUsers: () => of([]),
      createLobby: () => of({lobbyUuid: lobbyUuids[createCallCount++]}),
      deleteLobby: () => of({}),
      leaveLobby: () => of({}),
      listOpenPvpLobbies: () => of({lobbies: []}),
      startFight: () => of({fightUuid: 'fight-1'}),
      getLobby: () => of({lobbyUuid: '', fightMode: 'PVP', leader: 'user1', players: ['user1']})
    } as unknown as LobbyApiService;

    const facade = new QueueFacadeService(
      {selectedArea: 'forest', pvp: true} as AreaService,
      {get: () => 'user1'} as unknown as CookieService,
      {type: '', id: '', valuesSet: false} as FightService,
      lobbyApi,
      router,
      {transform: (key: string) => key} as TranslatePipe
    );
    return {facade, router};
  }

  it('creates a fresh lobby after the previous one is disposed', () => {
    const {facade} = buildFacade(['lobby-1', 'lobby-2']);

    facade.createLobby();
    expect(facade.lobbyUuid).toBe('lobby-1');

    facade.dispose();
    expect(facade.lobbyUuid).toBe('');

    facade.createLobby();
    expect(facade.lobbyUuid).toBe('lobby-2');
  });

  it('creates a fresh lobby for a new queue session after a fight was started', () => {
    const {facade, router} = buildFacade(['lobby-1', 'lobby-2']);

    facade.createLobby();
    expect(facade.lobbyUuid).toBe('lobby-1');

    facade.startFight();
    (router as {url: string}).url = '/fight/pvp/fight-1';
    facade.dispose();

    expect(facade.lobbyUuid).withContext('stale lobby must be cleared once the fight starts').toBe('');

    (router as {url: string}).url = '/queue';
    facade.createLobby();
    expect(facade.lobbyUuid).toBe('lobby-2');
  });
});
