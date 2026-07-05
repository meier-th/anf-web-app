import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, shareReplay} from 'rxjs';
import {User} from '../../classes/user';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class SocialApiService {
  // Friends/incoming/outgoing/ready/admin are all read concurrently by both the
  // friends panel and the users list on page load. Caching each with
  // shareReplay dedupes that concurrent burst; refCount resets the cache once
  // all subscribers complete, so later calls (e.g. after a friend action) still
  // hit the network for fresh data.
  private friends$: Observable<User[]> | null = null;
  private incomingRequests$: Observable<User[]> | null = null;
  private outgoingRequests$: Observable<User[]> | null = null;
  private readyUsers$: Observable<string[]> | null = null;
  private profileAdmin$: Observable<{admin: boolean}> | null = null;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiConfig.buildUrl('/users'), {withCredentials: true});
  }

  getUserByLogin(login: string): Observable<User> {
    return this.http.get<User>(this.apiConfig.buildUrl('/users/' + login), {withCredentials: true});
  }

  getFriends(): Observable<User[]> {
    if (!this.friends$) {
      this.friends$ = this.http.get<User[]>(this.apiConfig.buildUrl('/friends'), {withCredentials: true}).pipe(
        shareReplay({bufferSize: 1, refCount: true})
      );
    }
    return this.friends$;
  }

  getIncomingRequests(): Observable<User[]> {
    if (!this.incomingRequests$) {
      this.incomingRequests$ = this.http
        .get<User[]>(this.apiConfig.buildUrl('/friends/requests/incoming'), {withCredentials: true})
        .pipe(shareReplay({bufferSize: 1, refCount: true}));
    }
    return this.incomingRequests$;
  }

  getOutgoingRequests(): Observable<User[]> {
    if (!this.outgoingRequests$) {
      this.outgoingRequests$ = this.http
        .get<User[]>(this.apiConfig.buildUrl('/friends/requests/outgoing'), {withCredentials: true})
        .pipe(shareReplay({bufferSize: 1, refCount: true}));
    }
    return this.outgoingRequests$;
  }

  getReadyUsers(): Observable<string[]> {
    if (!this.readyUsers$) {
      this.readyUsers$ = this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true}).pipe(
        shareReplay({bufferSize: 1, refCount: true})
      );
    }
    return this.readyUsers$;
  }

  sendFriendRequest(username: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/profile/friends/requests'),
      new HttpParams().set('username', username),
      {
        headers: new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'}),
        withCredentials: true
      });
  }

  acceptFriend(login: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/profile/friends'),
      new HttpParams().set('login', login),
      {
        headers: new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'}),
        withCredentials: true
      });
  }

  deleteFriendRequest(username: string, type: 'in' | 'out'): Observable<any> {
    return this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends/requests'), {
      withCredentials: true,
      params: new HttpParams().append('username', username).append('type', type)
    });
  }

  deleteFriend(username: string): Observable<any> {
    return this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends'), {
      withCredentials: true,
      params: new HttpParams().append('username', username)
    });
  }

  getAdminUsers(): Observable<string[]> {
    return this.http.get<string[]>(this.apiConfig.buildUrl('/users/admins'), {withCredentials: true});
  }

  isProfileAdmin(): Observable<{admin: boolean}> {
    if (!this.profileAdmin$) {
      this.profileAdmin$ = this.http
        .get<{admin: boolean}>(this.apiConfig.buildUrl('/profile/isAdmin'), {withCredentials: true})
        .pipe(shareReplay({bufferSize: 1, refCount: true}));
    }
    return this.profileAdmin$;
  }

  grantAdmin(login: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/admin/users/' + login + '/grantAdmin'),
      new HttpParams(),
      {
        headers: new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'}),
        withCredentials: true,
        responseType: 'text'
      });
  }
}
