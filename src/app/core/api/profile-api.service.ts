import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, shareReplay} from 'rxjs';
import {Stats} from '../../classes/stats';
import {User} from '../../classes/user';
import {ApiConfigService} from '../config/api-config.service';

export type AppearancePayload = {
  gender: string;
  hairColour: string;
  skinColour: string;
  clothesColour: string;
};

@Injectable({
  providedIn: 'root'
})
export class ProfileApiService {
  private profile$: Observable<User> | null = null;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  // Several unrelated features (profile page, chat, users list, dialogue, fight
  // outcome) all read the same profile on load. shareReplay lets concurrent
  // callers share one in-flight request instead of each firing their own.
  // The cached observable keeps replaying the same value to every future
  // caller regardless of refCount, so callers must invalidate it via
  // clearCache() whenever the logged-in user changes (see MainFacadeService).
  getProfile(): Observable<User> {
    if (!this.profile$) {
      this.profile$ = this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true}).pipe(
        shareReplay({bufferSize: 1, refCount: true})
      );
    }
    return this.profile$;
  }

  clearCache(): void {
    this.profile$ = null;
  }

  getPveHistory(): Observable<any[]> {
    return this.http.get<any[]>(this.apiConfig.buildUrl('/profile/pvehistory'), {withCredentials: true});
  }

  getStats(login: string): Observable<Stats> {
    return this.http.get<Stats>(this.apiConfig.buildUrl(`/users/${login}/stats`), {withCredentials: true});
  }

  setReadyState(isReady: boolean): Observable<any> {
    const endpoint = isReady ? '/profile/online' : '/profile/offline';
    return this.http.get(this.apiConfig.buildUrl(endpoint), {withCredentials: true});
  }

  upgradeCharacter(quality: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/profile/character'),
      new HttpParams().set('quality', quality),
      {
        headers: new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'}),
        withCredentials: true
      });
  }

  saveAppearance(payload: AppearancePayload): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/profile/character/appearance'), null,
      {
        withCredentials: true,
        params: new HttpParams()
          .append('gender', payload.gender)
          .append('hairColour', payload.hairColour)
          .append('skinColour', payload.skinColour)
          .append('clothesColour', payload.clothesColour)
      });
  }
}
