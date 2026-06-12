import { Component, OnInit, Injector, NgZone } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {User} from '../classes/user';
import { FriendsPageComponent } from '../friends-page/friends-page.component';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {ConfirmationService, MessageService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Userdata } from '../classes/userdata';
import {ApiConfigService} from '../core/config/api-config.service';
import {Message as PrivateMessage} from '../classes/message';

@Component({
  selector: 'app-users-list',
  standalone: false,
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.less'],
  providers: [DialogService, ConfirmationService]
})
export class UsersListComponent implements OnInit {

  searchText = '';
  usersList: Userdata[];
  viewer: User;
  private stompClient;
  adminView: boolean = false;
  private dialog: DynamicDialogRef;
  unreadByUser: {[login: string]: number} = {};
  private activeChatLogin: string | null = null;


  constructor(private http: HttpClient, private injector: Injector,
    private dialogService: DialogService, private confirmationService: ConfirmationService,
    private apiConfig: ApiConfigService, private ngZone: NgZone) { }

  ngOnInit() {
        let tempUsrs: Userdata[] = [];
        this.http.get<User[]>(this.apiConfig.buildUrl('/users'), {withCredentials: true})
            .subscribe(dt => {
              dt.forEach(usr => {
                var usrdt = new Userdata();
                usrdt.user = usr;
                usrdt.admin = false;
                usrdt.notAdmin = true;
                usrdt.friend = false;
                usrdt.requested = false;
                usrdt.requesting = false;
                usrdt.noRelations = true;
                tempUsrs.push(usrdt);
              });
              this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/outgoing'),
                {withCredentials: true}).subscribe(dt => {
                  tempUsrs.forEach(ud => {
                    if (dt.map(u => u.login).includes(ud.user.login)) {
                      ud.requested = true;
                      ud.noRelations = false;
                    }
                  });
                  this.http.get<User[]>(this.apiConfig.buildUrl('/friends/requests/incoming'),
                    {withCredentials: true}).subscribe(dt => {
                      tempUsrs.forEach(ud => {
                        if (dt.map(u => u.login).includes(ud.user.login)) {
                          ud.requesting = true;
                          ud.noRelations = false;
                        }
                      });
                      this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true})
                        .subscribe(usr => {
                          this.viewer = usr;
                          this.http.get<{admin: boolean}>(this.apiConfig.buildUrl('/profile/isAdmin'), {withCredentials: true})
                            .subscribe({
                              next: (data) => {
                                this.adminView = !!data?.admin;
                              },
                              error: () => {
                                this.adminView = false;
                              }
                            });
                          this.initializeWebSockets();
                          tempUsrs.forEach(ud => {
                            if (ud.user.login === this.viewer.login)
                              tempUsrs.splice(tempUsrs.indexOf(ud), 1);
                          });
                          this.http.get<User[]>(this.apiConfig.buildUrl('/friends'), {withCredentials: true})
                            .subscribe(data => {
                              tempUsrs.forEach(ud => {
                                if (data.map(u => u.login).includes(ud.user.login)) {
                                  ud.friend = true;
                                  ud.noRelations = false;
                                }
                              });
                              var ready: string[] = [];
                              this.http.get<string[]>(this.apiConfig.buildUrl('/ready'), {withCredentials: true})
                                .subscribe(rd => {
                                  ready = rd;
                                  tempUsrs.forEach(ud => {
                                    if (ready.includes(ud.user.login)) {
                                      ud.user.online = true;
                                      ud.user.offline = false;
                                    } else {
                                      ud.user.online = false;
                                      ud.user.offline = true;
                                    }
                                  });
                                  this.http.get<string[]>(this.apiConfig.buildUrl('/users/admins'), {withCredentials: true})
                                    .subscribe({
                                      next: (admins) => {
                                        const adminSet = new Set(admins ?? []);
                                        tempUsrs.forEach((ud) => {
                                          ud.admin = adminSet.has(ud.user.login);
                                          ud.notAdmin = !ud.admin;
                                        });
                                        this.usersList = tempUsrs;
                                        this.loadUnreadMessageCounts();
                                      },
                                      error: () => {
                                        this.usersList = tempUsrs;
                                        this.loadUnreadMessageCounts();
                                      }
                                    });
                                });
                            });
                        });
                    });
                });
            });  
      
  }

  initializeWebSockets(): void {
    const ws = new SockJS(this.apiConfig.buildUrl('/socket'));
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function(frame) {
      that.stompClient.subscribe('/online', (message) => {
        that.ngZone.run(() => {
          const parsed = that.parseOnlineEvent(message.body);
          if (!parsed) {
            return;
          }
          const type = parsed.type;
          const user = parsed.user;
          if (type !== 'new') {
            that.usersList.forEach(ud => {
              if (ud.user.login === user) {
                ud.user.online = type === 'online';
                ud.user.offline = !ud.user.online;
              }
            });
            return;
          }

          that.http.get<User>(that.apiConfig.buildUrl('/users/' + user), {withCredentials: true})
            .subscribe(usr => {
              const newUd = new Userdata();
              newUd.admin = false;
              newUd.friend = false;
              newUd.noRelations = true;
              newUd.notAdmin = true;
              newUd.requested = false;
              newUd.requesting = false;
              newUd.user = usr;
              that.usersList.push(newUd);
            });
        });
      });

      that.stompClient.subscribe('/user/social', message => {
        that.ngZone.run(() => {
          const str = message.body;
          const i = str.indexOf(':');
          const event = str.substring(0, i);

          if (event === 'friend') {
            const type = str.substring(i + 1, i + 2);
            const username = str.substring(i + 2, str.length);
            console.log('usersList: friend ' + type + ' ' + username + ';');
            that.usersList.forEach(ud => {
              if (ud.user.login === username) {
                if (type === '+' || type === 'o') {
                  ud.friend = true;
                  ud.requested = false;
                  ud.requesting = false;
                } else {
                  ud.friend = false;
                  ud.noRelations = true;
                }
              }
            });
          } else if (event === 'request') {
            const type = str.substring(i + 1, i + 2);
            const username = str.substring(i + 2, str.length);
            that.usersList.forEach(ud => {
              if (ud.user.login === username) {
                if (type === '+') {
                  ud.requesting = true;
                  ud.noRelations = false;
                } else if (type === '-') {
                  ud.requesting = false;
                  ud.noRelations = true;
                } else if (type === '/') {
                  ud.requested = false;
                  ud.noRelations = true;
                }
              }
            });
          } else if (event === 'decline') {
            const username = str.substring(i + 1, str.length);
            that.usersList.forEach(ud => {
              if (ud.user.login === username) {
                ud.requested = false;
                ud.noRelations = true;
              }
            });
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

      if (that.adminView) {
        that.stompClient.subscribe('/admin/admins', message => {
          that.ngZone.run(() => {
            const logn = message.body;
            that.usersList.forEach(ud => {
              if (ud.user.login === logn) {
                ud.admin = true;
                ud.notAdmin = false;
              }
            });
          });
        });
      }
    });
  }


  deleteReq(ud: Userdata): void {
    this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends/requests'),
      {withCredentials: true, params: new HttpParams().append('username', ud.user.login).append('type', 'out')}).subscribe();
    ud.noRelations = true;
    ud.requested = false;
  }

  declineReq(ud: Userdata): void {
    this.http.delete<string>(this.apiConfig.buildUrl('/profile/friends/requests'),
      {withCredentials: true, params: new HttpParams().append('username', ud.user.login).append('type', 'in')}).subscribe();
    ud.noRelations = true;
    ud.requesting = false;
  }

  acceptReq(ud: Userdata): void {
    this.http.post(this.apiConfig.buildUrl('/profile/friends'), 
    new HttpParams().set('login', ud.user.login),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }), 
    withCredentials: true }).subscribe( msg => {});
    ud.friend = true;
    ud.requesting = false;
  }

  sendRequest(ud: Userdata): void {
    this.http.post(this.apiConfig.buildUrl('/profile/friends/requests'), 
    new HttpParams().set('username', ud.user.login),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }), 
    withCredentials: true }).subscribe( msg => {});
    ud.noRelations = false;
    ud.requested = true;
  }

  openMessageWindow(ud: Userdata): void {
    this.clearUnreadForUser(ud.user.login);
    this.activeChatLogin = ud.user.login;
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: '760px',
      height: '560px',
      closable: false,
      data: {
        username: ud.user.login
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

  grantAdmin(ud: Userdata): void {
    var url = this.apiConfig.buildUrl('/admin/users/' + ud.user.login + '/grantAdmin');
    this.http.post(url, 
    new HttpParams(),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }),
    withCredentials: true,
    responseType: 'text' }).subscribe(() => {
      ud.admin = true;
      ud.notAdmin = false;
    });
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
