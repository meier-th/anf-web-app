import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {User} from '../classes/user';
import {HttpClient, HttpParams, HttpHeaderResponse, HttpHeaders} from '@angular/common/http';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ApiConfigService} from '../core/config/api-config.service';
import {Message as PrivateMessage} from '../classes/message';

@Component({
  selector: 'app-friends-page',
  standalone: false,
  templateUrl: './friends-page.component.html',
  styleUrls: ['./friends-page.component.less'],
  providers: [DialogService, ConfirmationService]
})
export class FriendsPageComponent implements OnInit, OnDestroy {

  selectedTab: 'friends' | 'incoming' | 'pending' = 'friends';
  friends: User[] = [];
  inRequested: User[] = [];
  outRequested: User[] = [];
  unreadByUser: {[login: string]: number} = {};
  private stompClient: any;
  private dialog: DynamicDialogRef;
  private activeChatLogin: string | null = null;

  constructor(private http: HttpClient, private dialogService: DialogService,
              private confirmationService: ConfirmationService,
              private apiConfig: ApiConfigService, private ngZone: NgZone) {
  }

  ngOnInit() {
    this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/incoming'), {withCredentials: true})
      .subscribe(data => this.inRequested = data);
    this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/outgoing'), {withCredentials: true})
      .subscribe(data => this.outRequested = data);
    this.http.get<User[]>(this.apiConfig.buildUrl('/friends'), {withCredentials: true})
      .subscribe(data => {
        this.friends = data;
        this.checkOnline();
        this.loadUnreadMessageCounts();
      });

    this.initializeWebSockets();
  }

  ngOnDestroy(): void {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.disconnect(() => {});
    }
  }

  setTab(tab: 'friends' | 'incoming' | 'pending'): void {
    this.selectedTab = tab;
  }

  getTabCount(tab: 'friends' | 'incoming' | 'pending'): number {
    if (tab === 'friends') {
      return this.friends.length;
    }
    if (tab === 'incoming') {
      return this.inRequested.length;
    }
    return this.outRequested.length;
  }

  initializeWebSockets() {
    const ws = new SockJS(this.apiConfig.buildUrl('/socket'));
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/online', (message) => {
        that.ngZone.run(() => {
          const parsed = that.parseOnlineEvent(message.body);
          if (!parsed || parsed.type === 'new') {
            return;
          }
          const user = parsed.user;
          const type = parsed.type;
          if (that.friends.map(friend => friend.login).includes(user)) {
            that.friends.forEach(friend => {
              if (friend.login === user) {
                friend.online = type === 'online';
                friend.offline = !friend.online;
              }
            });
          }
        });
      });
      that.stompClient.subscribe('/user/social', message => {
        that.ngZone.run(() => {
          const str = message.body;
          const i = str.indexOf(':');
          const event = str.substring(0, i);
          // console.log("event: "+event);
          if (event === 'friend') {
            const type = str.substring(i + 1, i + 2);
            // console.log("type: "+type);
            if (type === '+' || type === 'o') {
              const username = str.substring(i + 2, str.length);
              let user: User;
              // console.log("username: "+username);
              const url = that.apiConfig.buildUrl('/users/' + username);
              that.http.get<User>(url, {withCredentials: true})
                .subscribe(data => {
                  user = data;
                  that.addUniqueByLogin(that.friends, user);
                  that.refreshFriendOnlineStatus(user.login);
                  that.scheduleFriendsOnlineResync();
                });
              if (type === '+') {
                that.removeByLogin(that.outRequested, username);
              } else {
                that.removeByLogin(that.inRequested, username);
              }
            } else if (type === '-') {
              const username = str.substring(i + 2, str.length);
              that.removeByLogin(that.friends, username);
            }
          } else if (event === 'request') {
            const username = str.substring(i + 2, str.length);
            const type = str.substring(i + 1, i + 2);
            // console.log("type: "+type);
            if (type === '+' || type === 'o') {
              const username = str.substring(i + 2, str.length);
              let user: User;
              // console.log("username: "+username);
              const url = that.apiConfig.buildUrl('/users/' + username);
              that.http.get<User>(url, {withCredentials: true})
                .subscribe(data => {
                  user = data;
                  if (type === '+') {
                    that.addUniqueByLogin(that.inRequested, user);
                  } else {
                    that.addUniqueByLogin(that.outRequested, user);
                  }
                });
            } else {
              let user: User;
              // console.log("username: "+username);
              const url = that.apiConfig.buildUrl('/users/' + username);
              that.http.get<User>(url, {withCredentials: true})
                .subscribe(data => {
                  user = data;
                  if (type === '-') {
                    that.removeByLogin(that.inRequested, user.login);
                  } else {
                    that.removeByLogin(that.outRequested, user.login);
                  }
                });
            }
          } else {
            const username = str.substring(i + 1, str.length);
            that.removeByLogin(that.outRequested, username);
          }
        });
      });

      that.stompClient.subscribe('/user/msg', (message) => {
        that.ngZone.run(() => {
          const str = message.body as string;
          const i = str.indexOf(':');
          if (i < 0) {
            return;
          }
          const author = str.substring(0, i);
          if (author === that.activeChatLogin) {
            return;
          }
          that.loadUnreadMessageCounts();
        });
      });
    });
  }

  addFriend(req: User): void {
    this.http.post(this.apiConfig.buildUrl('/profile/friends'),
      new HttpParams().set('login', req.login),
      {
        headers:
          new HttpHeaders(
            {
              'Content-Type': 'application/x-www-form-urlencoded'
            }),
        withCredentials: true
      }).subscribe(msg => {
    });
    this.addUniqueByLogin(this.friends, req);
    this.refreshFriendOnlineStatus(req.login);
    this.scheduleFriendsOnlineResync();
    this.removeByLogin(this.inRequested, req.login);
  }

  deleteRequest(req: User): void {
    const username = req.login;
    this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends/requests'), {
      withCredentials: true,
      params: new HttpParams().append('username', username).append('type', 'out')
    }).subscribe(data => {
      console.log(data);
    });
    this.removeByLogin(this.outRequested, req.login);
  }

  checkOnline() {
    this.friends.forEach(frnd => {
      frnd.offline = true;
      frnd.online = false;
    });
    this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true})
      .subscribe(result => {
        console.log(result);
        this.friends.forEach(friend => {
          if (result.includes(friend.login)) {
            friend.online = true;
            friend.offline = false;
          }

        });
      });
    // ready.forEach(rd => console.log(rd));

  }

  declineReq(req: User): void {
    const username = req.login;
    this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends/requests'), {
      withCredentials: true,
      params: new HttpParams().append('username', username).append('type', 'in')
    }).subscribe(data => {
      console.log(data);
    });
    this.removeByLogin(this.inRequested, req.login);
  }

  deleteFriend(usr: User): void {
    const username = usr.login;
    this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends'), {
      withCredentials: true,
      params: new HttpParams().append('username', username)
    }).subscribe(data => {
      console.log(data);
    });
    this.removeByLogin(this.friends, usr.login);
  }

  inviteToPVP(usr: User): void {

  }

  showMessageInput(user: User): void {
    this.clearUnreadForUser(user.login);
    this.activeChatLogin = user.login;
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: '760px',
      height: '560px',
      closable: false,
      data: {
        username: user.login
      }
    });
    this.dialog.onClose.subscribe(() => {
      this.activeChatLogin = null;
      this.loadUnreadMessageCounts();
    });
  }

  getUnreadCount(login: string): number {
    return this.unreadByUser[login] ?? 0;
  }

  private removeByLogin(users: User[], login: string): void {
    const index = users.findIndex(user => user.login === login);
    if (index > -1) {
      users.splice(index, 1);
    }
  }

  private addUniqueByLogin(users: User[], user: User): void {
    if (!users.some(existingUser => existingUser.login === user.login)) {
      users.push(user);
    }
  }

  private refreshFriendOnlineStatus(login: string): void {
    this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true})
      .subscribe(ready => {
        const friend = this.friends.find(existing => existing.login === login);
        if (!friend) {
          return;
        }
        friend.online = ready.includes(login);
        friend.offline = !friend.online;
      });
  }

  private scheduleFriendsOnlineResync(): void {
    setTimeout(() => this.checkOnline(), 350);
    setTimeout(() => this.checkOnline(), 1400);
  }

  private parseOnlineEvent(body: string): { user: string; type: string } | null {
    const i = body.indexOf(':');
    if (i < 0) {
      return null;
    }
    const left = body.substring(0, i);
    const right = body.substring(i + 1);
    const knownTypes = ['online', 'offline', 'new'];
    if (knownTypes.includes(left)) {
      return {user: right, type: left};
    }
    return {user: left, type: right};
  }

  private clearUnreadForUser(login: string): void {
    this.unreadByUser[login] = 0;
  }

  private loadUnreadMessageCounts(): void {
    this.http.get<PrivateMessage[]>(this.apiConfig.buildUrl('/profile/messages/unread'), {withCredentials: true})
      .subscribe(messages => {
        this.unreadByUser = {};
        (messages ?? []).forEach(message => {
          const sender = message?.sender?.login;
          if (!sender) {
            return;
          }
          this.unreadByUser[sender] = (this.unreadByUser[sender] ?? 0) + 1;
        });
      });
  }

}
