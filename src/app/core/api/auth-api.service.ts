import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {defer, Observable} from 'rxjs';
import {ApiConfigService} from '../config/api-config.service';

export interface SessionCheckResponse {
  authorized: boolean;
  login: string;
}

export interface RegisterRequest {
  login: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  private ensureSecureAuthTransport() {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (window.location.protocol !== 'https:' && !isLocalhost) {
      throw new Error('Credentials can only be sent over HTTPS.');
    }
  }

  checkCookies(): Observable<SessionCheckResponse> {
    return this.http.get<SessionCheckResponse>(this.apiConfig.buildUrl('/checkCookies'), {
      withCredentials: true
    });
  }

  login(username: string, password: string): Observable<unknown> {
    return defer(() => {
      this.ensureSecureAuthTransport();

      const body = new HttpParams().set('username', username).set('password', password).toString();
      return this.http.post(this.apiConfig.buildUrl('/login'), body, {
        withCredentials: true,
        observe: 'response',
        headers: new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'})
      });
    });
  }

  register(payload: RegisterRequest): Observable<unknown> {
    return defer(() => {
      this.ensureSecureAuthTransport();
      return this.http.post(this.apiConfig.buildUrl('/registration'), payload, {
        withCredentials: true,
        observe: 'response'
      });
    });
  }

  logout(): Observable<string> {
    return this.http.get(this.apiConfig.buildUrl('/logout'), {responseType: 'text'});
  }

  setOnline(): Observable<string> {
    return this.http.get(this.apiConfig.buildUrl('/profile/online'), {responseType: 'text', withCredentials: true});
  }

  setOffline(): Observable<string> {
    return this.http.get(this.apiConfig.buildUrl('/profile/offline'), {responseType: 'text', withCredentials: true});
  }
}
