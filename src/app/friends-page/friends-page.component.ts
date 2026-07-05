import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {forkJoin} from 'rxjs';
import {User} from '../classes/user';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Message as PrivateMessage} from '../classes/message';
import {SocialApiService} from '../core/api/social-api.service';
import {MessageApiService} from '../core/api/message-api.service';
import {SocialRealtimeService} from '../core/realtime/social-realtime.service';
import {SocialDomainService} from '../core/domain/social-domain.service';
import {DIALOG_SIZES} from '../core/constants/app.constants';
import {CompatClient} from '@stomp/stompjs';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-friends-page',
    templateUrl: './friends-page.component.html',
    styleUrls: ['./friends-page.component.less'],
    providers: [DialogService, ConfirmationService],
    imports: [Bind, Button, TranslatePipe]
})
export class FriendsPageComponent implements OnInit, OnDestroy {

  selectedTab: 'friends' | 'incoming' | 'pending' = 'friends';
  friends: User[] = [];
  inRequested: User[] = [];
  outRequested: User[] = [];
  unreadByUser: {[login: string]: number} = {};
  private stompClient: CompatClient;
  private dialog: DynamicDialogRef;
  private activeChatLogin: string | null = null;

  constructor(private dialogService: DialogService,
              private confirmationService: ConfirmationService,
              private socialApi: SocialApiService, private messageApi: MessageApiService,
              private socialRealtime: SocialRealtimeService, private socialDomain: SocialDomainService,
              private ngZone: NgZone) {
  }

  ngOnInit() {
    this.socialApi.getIncomingRequests()
      .subscribe(data => this.inRequested = data);
    this.socialApi.getOutgoingRequests()
      .subscribe(data => this.outRequested = data);
    // Friends and ready-status don't depend on each other, so fetch both in
    // parallel and only join them once both resolve, instead of waiting for
    // friends before even starting the ready-status request.
    forkJoin({
      friends: this.socialApi.getFriends(),
      ready: this.socialApi.getReadyUsers()
    }).subscribe(({friends, ready}) => {
      this.friends = friends;
      this.applyOnlineStatus(ready);
    });
    this.loadUnreadMessageCounts();

    this.initializeWebSockets();
  }

  ngOnDestroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
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
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeOnline(client, (body) => {
        this.ngZone.run(() => {
          const parsed = this.socialDomain.parseOnlineEvent(body);
          if (!parsed || parsed.type === 'new') {
            return;
          }
          const user = parsed.user;
          const type = parsed.type;
          if (this.friends.map(friend => friend.login).includes(user)) {
            this.friends.forEach(friend => {
              if (friend.login === user) {
                friend.online = type === 'online';
                friend.offline = !friend.online;
              }
            });
          }
        });
      });
      this.socialRealtime.subscribeSocial(client, (str) => {
        this.ngZone.run(() => {
          const i = str.indexOf(':');
          const event = str.substring(0, i);
          if (event === 'friend') {
            const type = str.substring(i + 1, i + 2);
            if (type === '+' || type === 'o') {
              const username = str.substring(i + 2, str.length);
              let user: User;
              this.socialApi.getUserByLogin(username)
                .subscribe(data => {
                  user = data;
                  this.addUniqueByLogin(this.friends, user);
                  this.refreshFriendOnlineStatus(user.login);
                  this.scheduleFriendsOnlineResync();
                });
              if (type === '+') {
                this.removeByLogin(this.outRequested, username);
              } else {
                this.removeByLogin(this.inRequested, username);
              }
            } else if (type === '-') {
              const username = str.substring(i + 2, str.length);
              this.removeByLogin(this.friends, username);
            }
          } else if (event === 'request') {
            const username = str.substring(i + 2, str.length);
            const type = str.substring(i + 1, i + 2);
            if (type === '+' || type === 'o') {
              const username = str.substring(i + 2, str.length);
              let user: User;
              this.socialApi.getUserByLogin(username)
                .subscribe(data => {
                  user = data;
                  if (type === '+') {
                    this.addUniqueByLogin(this.inRequested, user);
                  } else {
                    this.addUniqueByLogin(this.outRequested, user);
                  }
                });
            } else {
              let user: User;
              this.socialApi.getUserByLogin(username)
                .subscribe(data => {
                  user = data;
                  if (type === '-') {
                    this.removeByLogin(this.inRequested, user.login);
                  } else {
                    this.removeByLogin(this.outRequested, user.login);
                  }
                });
            }
          } else {
            const username = str.substring(i + 1, str.length);
            this.removeByLogin(this.outRequested, username);
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
    });
  }

  addFriend(req: User): void {
    this.socialApi.acceptFriend(req.login).subscribe();
    this.addUniqueByLogin(this.friends, req);
    this.refreshFriendOnlineStatus(req.login);
    this.scheduleFriendsOnlineResync();
    this.removeByLogin(this.inRequested, req.login);
  }

  deleteRequest(req: User): void {
    const username = req.login;
    this.socialApi.deleteFriendRequest(username, 'out').subscribe();
    this.removeByLogin(this.outRequested, req.login);
  }

  checkOnline() {
    this.friends.forEach(frnd => {
      frnd.offline = true;
      frnd.online = false;
    });
    this.socialApi.getReadyUsers().subscribe(result => this.applyOnlineStatus(result));
  }

  private applyOnlineStatus(readyLogins: string[]): void {
    this.friends.forEach(friend => {
      friend.online = readyLogins.includes(friend.login);
      friend.offline = !friend.online;
    });
  }

  declineReq(req: User): void {
    const username = req.login;
    this.socialApi.deleteFriendRequest(username, 'in').subscribe();
    this.removeByLogin(this.inRequested, req.login);
  }

  deleteFriend(usr: User): void {
    const username = usr.login;
    this.socialApi.deleteFriend(username).subscribe();
    this.removeByLogin(this.friends, usr.login);
  }

  inviteToPVP(usr: User): void {

  }

  showMessageInput(user: User): void {
    this.clearUnreadForUser(user.login);
    this.activeChatLogin = user.login;
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: DIALOG_SIZES.chat.width,
      height: DIALOG_SIZES.chat.height,
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
    this.socialApi.getReadyUsers()
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

  private clearUnreadForUser(login: string): void {
    this.unreadByUser[login] = 0;
  }

  private loadUnreadMessageCounts(): void {
    this.messageApi.getUnreadMessages()
      .subscribe(messages => {
        this.unreadByUser = this.socialDomain.buildUnreadByUser(messages ?? []);
      });
  }

}
