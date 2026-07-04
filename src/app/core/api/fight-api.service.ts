import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class FightApiService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  getInfo<T>(fightUuid: string): Observable<T> {
    return this.http.post<T>(this.apiConfig.buildUrl('/fight/info'), null, {
      withCredentials: true,
      params: new HttpParams().append('fightUuid', fightUuid)
    });
  }

  attack(fightUuid: string, enemy: string, spellName: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/fight/attack'), null, {
      withCredentials: true,
      params: new HttpParams()
        .append('fightUuid', fightUuid)
        .append('enemy', enemy)
        .append('spellName', spellName)
    });
  }

  reportTimeout(fightUuid: string, timedOutAttacker: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/fight/timeout'), null, {
      withCredentials: true,
      params: new HttpParams()
        .append('fightUuid', fightUuid)
        .append('timedOutAttacker', timedOutAttacker)
    });
  }

  surrender(fightUuid: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/fight/surrender'), null, {
      withCredentials: true,
      params: new HttpParams().append('fightUuid', fightUuid)
    });
  }

  summon(type: string, fightUuid: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/fight/summon' +
      type.substring(0, 1).toUpperCase() +
      type.substring(1).toLowerCase()), null, {
      withCredentials: true,
      params: new HttpParams().append('fightUuid', fightUuid)
    });
  }
}
