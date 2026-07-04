import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import {User} from '../classes/user';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import { Userdata } from '../classes/userdata';
import {SocialApiService} from '../core/api/social-api.service';
import {MessageApiService} from '../core/api/message-api.service';
import {SocialRealtimeService} from '../core/realtime/social-realtime.service';
import {SocialDomainService} from '../core/domain/social-domain.service';
import {DIALOG_SIZES} from '../core/constants/app.constants';
import {UsersListFacadeService} from '../core/facade/users-list.facade.service';
import {CompatClient} from '@stomp/stompjs';
import { FormsModule } from '@angular/forms';
import { Bind } from 'primeng/bind';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { SearchUsersPipe } from '../services/search-users.pipe';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-users-list',
    templateUrl: './users-list.component.html',
    styleUrls: ['./users-list.component.less'],
    providers: [DialogService, ConfirmationService],
    imports: [FormsModule, Bind, InputText, Button, SearchUsersPipe, TranslatePipe]
})
export class UsersListComponent implements OnInit, OnDestroy {

  searchText = '';
  usersList: Userdata[];
  viewer: User;
  private stompClient: CompatClient;
  adminView: boolean = false;
  private dialog: DynamicDialogRef;
  unreadByUser: {[login: string]: number} = {};
  private activeChatLogin: string | null = null;


  constructor(private socialApi: SocialApiService, private messageApi: MessageApiService,
    private socialRealtime: SocialRealtimeService,
    private socialDomain: SocialDomainService,
    private usersListFacade: UsersListFacadeService,
    private dialogService: DialogService, private confirmationService: ConfirmationService,
    private ngZone: NgZone) { }

  ngOnInit() {
    this.usersListFacade.loadInitialState().subscribe((state) => {
      this.viewer = state.viewer;
      this.adminView = state.adminView;
      this.usersList = state.usersList;
      this.initializeWebSockets();
      this.loadUnreadMessageCounts();
    });
  }

  initializeWebSockets(): void {
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeOnline(client, (body) => {
        this.ngZone.run(() => {
          const parsed = this.socialDomain.parseOnlineEvent(body);
          if (!parsed) {
            return;
          }
          const type = parsed.type;
          const user = parsed.user;
          if (type !== 'new') {
            this.usersList.forEach(ud => {
              if (ud.user.login === user) {
                ud.user.online = type === 'online';
                ud.user.offline = !ud.user.online;
              }
            });
            return;
          }

          this.socialApi.getUserByLogin(user)
            .subscribe(usr => {
              const newUd = new Userdata();
              newUd.admin = false;
              newUd.friend = false;
              newUd.noRelations = true;
              newUd.notAdmin = true;
              newUd.requested = false;
              newUd.requesting = false;
              newUd.user = usr;
              this.usersList.push(newUd);
            });
        });
      });

      this.socialRealtime.subscribeSocial(client, (str) => {
        this.ngZone.run(() => {
          const i = str.indexOf(':');
          const event = str.substring(0, i);

          if (event === 'friend') {
            const type = str.substring(i + 1, i + 2);
            const username = str.substring(i + 2, str.length);
            this.usersList.forEach(ud => {
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
            this.usersList.forEach(ud => {
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
            this.usersList.forEach(ud => {
              if (ud.user.login === username) {
                ud.requested = false;
                ud.noRelations = true;
              }
            });
          }
        });
      });

      this.socialRealtime.subscribeUserMessages(client, (str) => {
        this.ngZone.run(() => {
          const i = str.indexOf(':');
          if (i < 0) {
            return;
          }
          const author = str.substring(0, i);
          if (author === this.activeChatLogin) {
            return;
          }
          this.loadUnreadMessageCounts();
        });
      });

      if (this.adminView) {
        this.socialRealtime.subscribeAdminUpdates(client, (logn) => {
          this.ngZone.run(() => {
            this.usersList.forEach(ud => {
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
    this.socialApi.deleteFriendRequest(ud.user.login, 'out').subscribe();
    ud.noRelations = true;
    ud.requested = false;
  }

  declineReq(ud: Userdata): void {
    this.socialApi.deleteFriendRequest(ud.user.login, 'in').subscribe();
    ud.noRelations = true;
    ud.requesting = false;
  }

  acceptReq(ud: Userdata): void {
    this.socialApi.acceptFriend(ud.user.login).subscribe();
    ud.friend = true;
    ud.requesting = false;
  }

  sendRequest(ud: Userdata): void {
    this.socialApi.sendFriendRequest(ud.user.login).subscribe();
    ud.noRelations = false;
    ud.requested = true;
  }

  openMessageWindow(ud: Userdata): void {
    this.clearUnreadForUser(ud.user.login);
    this.activeChatLogin = ud.user.login;
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: DIALOG_SIZES.chat.width,
      height: DIALOG_SIZES.chat.height,
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
    this.socialApi.grantAdmin(ud.user.login).subscribe(() => {
      ud.admin = true;
      ud.notAdmin = false;
    });
  }

  private clearUnreadForUser(login: string): void {
    this.unreadByUser[login] = 0;
  }

  private loadUnreadMessageCounts(): void {
    this.messageApi.getUnreadMessages()
      .subscribe(messages => {
        this.unreadByUser = this.socialDomain.buildUnreadByUser(messages ?? []);
      });
  }

  ngOnDestroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
  }

}
