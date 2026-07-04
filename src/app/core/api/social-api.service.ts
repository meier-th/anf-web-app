import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {User} from '../../classes/user';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class SocialApiService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiConfig.buildUrl('/users'), {withCredentials: true});
  }

  getUserByLogin(login: string): Observable<User> {
    return this.http.get<User>(this.apiConfig.buildUrl('/users/' + login), {withCredentials: true});
  }

  getFriends(): Observable<User[]> {
    return this.http.get<User[]>(this.apiConfig.buildUrl('/friends'), {withCredentials: true});
  }

  getIncomingRequests(): Observable<User[]> {
    return this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/incoming'), {withCredentials: true});
  }

  getOutgoingRequests(): Observable<User[]> {
    return this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/outgoing'), {withCredentials: true});
  }

  getReadyUsers(): Observable<string[]> {
    return this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true});
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
    return this.http.get<{admin: boolean}>(this.apiConfig.buildUrl('/profile/isAdmin'), {withCredentials: true});
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
