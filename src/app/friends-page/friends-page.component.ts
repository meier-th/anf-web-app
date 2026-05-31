import {Component, OnDestroy, OnInit} from '@angular/core';
import {User} from '../classes/user';
import {HttpClient, HttpParams, HttpHeaderResponse, HttpHeaders} from '@angular/common/http';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {SingleMessageService} from '../services/single-message.service';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ApiConfigService} from '../core/config/api-config.service';

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
  private stompClient: any;
  private dialog: DynamicDialogRef;

  constructor(private http: HttpClient, private dialogService: DialogService,
              private confirmationService: ConfirmationService, private msgServ: SingleMessageService,
              private apiConfig: ApiConfigService) {
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
        const str = message.body; // format: {username}:{online/offline}
        const i = str.indexOf(':');
        const user = str.substring(0, i);
        const type = str.substring(i + 1, str.length);
        if (that.friends.map(friend => friend.login).includes(user)) {
          if (type === 'online') {
            that.friends.forEach(friend => {
              if (friend.login === user) {
                friend.online = true;
                friend.offline = false;
              }
            });
          } else {
            that.friends.forEach(friend => {
              if (friend.login === user) {
                friend.offline = true;
                friend.online = false;
              }
            });
          }
        }
      });
      that.stompClient.subscribe('/user/social', message => {
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
                user.online = false;
                user.offline = true;
                let ready = [];
                that.http.get<string[]>(that.apiConfig.buildUrl('/ready'), {withCredentials: true})
                  .subscribe(data => {
                    ready = data;
                    if (ready.includes(user.login)) {
                      user.online = true;
                      user.offline = false;
                    }
                  });
                that.addUniqueByLogin(that.friends, user);
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
            const username = str.substring(i + 2, str.length);
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
  }

  addFriend(req: User): void {
    req.offline = true;
    req.online = false;
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
    this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true})
      .subscribe(data => {
        const ready: string[] = data;
        if (ready.includes(req.login)) {
          req.offline = false;
          req.online = true;
        }
      });
    this.addUniqueByLogin(this.friends, req);
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
    this.msgServ.username = user.login;
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: '800px', height: '400px'
    });
    this.msgServ.closingObj = this.dialog;
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

}
