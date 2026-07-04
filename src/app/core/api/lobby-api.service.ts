import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class LobbyApiService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  getReadyUsers(): Observable<string[]> {
    return this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true});
  }

  createLobby(mode: 'PVP' | 'TEAM_PVE'): Observable<{ lobbyUuid: string }> {
    return this.http.post<{ lobbyUuid: string }>(
      this.apiConfig.buildUrl('/fight/lobbies'),
      null,
      {
        withCredentials: true,
        params: new HttpParams().append('mode', mode)
      });
  }

  listOpenPvpLobbies(): Observable<{ lobbies: Array<any> }> {
    return this.http.get<{ lobbies: Array<any> }>(this.apiConfig.buildUrl('/fight/lobbies'), {
      withCredentials: true,
      params: new HttpParams().append('mode', 'PVP')
    });
  }

  joinLobby(lobbyUuid: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}/join`), null, {
      withCredentials: true
    });
  }

  leaveLobby(lobbyUuid: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}/leave`), null, {
      withCredentials: true
    });
  }

  deleteLobby(lobbyUuid: string): Observable<any> {
    return this.http.delete(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}`), {withCredentials: true});
  }

  getLobby(lobbyUuid: string): Observable<{
    lobbyUuid: string;
    fightMode: string;
    leader: string;
    players: string[];
  }> {
    return this.http.get<{
      lobbyUuid: string;
      fightMode: string;
      leader: string;
      players: string[];
    }>(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}`), {withCredentials: true});
  }

  startFight(lobbyUuid: string, bossId?: string): Observable<{ fightUuid: string }> {
    let params = new HttpParams();
    if (bossId) {
      params = params.append('bossId', bossId);
    }
    return this.http.post<{ fightUuid: string }>(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}/start`), null, {
      withCredentials: true,
      params
    });
  }
}
