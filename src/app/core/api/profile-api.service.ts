import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
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
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  getProfile(): Observable<User> {
    return this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true});
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
