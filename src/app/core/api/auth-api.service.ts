import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ApiConfigService} from '../config/api-config.service';

export interface SessionCheckResponse {
  authorized: boolean;
  login: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  checkCookies(): Observable<SessionCheckResponse> {
    return this.http.get<SessionCheckResponse>(this.apiConfig.buildUrl('/checkCookies'), {
      withCredentials: true
    });
  }

  login(username: string, password: string): Observable<unknown> {
    return this.http.post(this.apiConfig.buildUrl('/login'), null, {
      withCredentials: true,
      observe: 'response',
      params: new HttpParams().append('username', username).append('password', password)
    });
  }

  logout(): Observable<string> {
    return this.http.get(this.apiConfig.buildUrl('/logout'), {responseType: 'text'});
  }
}
