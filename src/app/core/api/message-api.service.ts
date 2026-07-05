import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {Message} from '../../classes/message';
import {User} from '../../classes/user';
import {ApiConfigService} from '../config/api-config.service';
import {ProfileApiService} from './profile-api.service';

@Injectable({
  providedIn: 'root'
})
export class MessageApiService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private profileApi: ProfileApiService
  ) {}

  getProfile(): Observable<User> {
    return this.profileApi.getProfile();
  }

  getDialogs(): Observable<string[]> {
    return this.http.get<string[]>(this.apiConfig.buildUrl('/profile/dialogs'), {withCredentials: true});
  }

  getDialogue(secondName: string): Observable<Message[]> {
    return this.http.get<Message[]>(this.apiConfig.buildUrl('/profile/messages/dialog'), {
      withCredentials: true,
      params: new HttpParams().append('secondName', secondName)
    });
  }

  sendMessage(receiver: string, message: string): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl('/profile/messages'), null, {
      withCredentials: true,
      responseType: 'text',
      params: new HttpParams()
        .append('message', message)
        .append('receiver', receiver)
    });
  }

  getUnreadMessages(): Observable<Message[]> {
    return this.http.get<Message[]>(this.apiConfig.buildUrl('/profile/messages/unread'), {withCredentials: true});
  }

  markMessageAsRead(messageId: number): Observable<any> {
    return this.http.post(this.apiConfig.buildUrl(`/profile/messages/${messageId}/read`), null, {
      withCredentials: true,
      responseType: 'text'
    });
  }
}
