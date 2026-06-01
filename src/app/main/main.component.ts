import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {ConfirmationService, MessageService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {AuthComponent} from '../auth/auth.component';
import {CookieService} from 'ngx-cookie-service';
import {CompatClient} from '@stomp/stompjs';
import {RoomComponent} from '../room/room.component';
import {FightService} from '../services/fight/fight.service';
import {TranslateService} from '../services/translate.service';
import {TranslatePipe} from '../services/translate.pipe';
import {AuthApiService} from '../core/api/auth-api.service';
import {SessionStore} from '../core/state/session.store';
import {WebsocketGatewayService} from '../core/realtime/websocket-gateway.service';
import {HistoryComponent} from '../history/history.component';

@Component({
  selector: 'app-main',
  standalone: false,
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.less'],
  providers: [DialogService, ConfirmationService]
})
export class MainComponent implements OnInit, OnDestroy {
  constructor(public router: Router, private dialogService: DialogService,
              private cookieService: CookieService, private authApi: AuthApiService,
              public messageService: MessageService, private fightService: FightService,
              private confirmationService: ConfirmationService,
              private translate: TranslateService, private pipe: TranslatePipe,
              private sessionStore: SessionStore, private wsGateway: WebsocketGatewayService) {
  }

  loggedIn: boolean;
  login: string;
  dialog: DynamicDialogRef;
  private stompClient: CompatClient;
  russian = false;
  display = false;
  languageMenuOpen = false;
  currentLanguage: 'en' | 'ru' = 'en';
  private onlineHeartbeatId: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.loggedIn = this.cookieService.get('loggedIn') === 'true';
    this.login = this.cookieService.get('username');
    this.sessionStore.setSession(this.loggedIn, this.login ?? '');
    if (this.loggedIn) {
      this.authApi.checkCookies().subscribe((response: { authorized: boolean, login: string }) => {
        this.loggedIn = true;
        this.login = response.login;
        this.sessionStore.setSession(true, response.login);
        this.cookieService.set('username', response.login);
        this.cookieService.set('loggedIn', 'true');
        this.authApi.setOnline().subscribe();
        this.startOnlineHeartbeat();
        if (this.router.url === '/start' || this.router.url === '/') {
          this.router.navigateByUrl('main');
        }
      }, (response: { authorized: boolean, login: string }) => {
        this.loggedIn = false;
        this.sessionStore.clearSession();
      this.stopOnlineHeartbeat();
        this.cookieService.delete('loggedIn');
        this.cookieService.delete('username');
        this.router.navigateByUrl('start');
      });
    }
    this.initializeWebsockets();
    this.setLanguage(this.russian ? 'ru' : 'en');
  }

  toggleLanguageMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.languageMenuOpen = !this.languageMenuOpen;
  }

  setLanguage(language: 'en' | 'ru'): void {
    this.currentLanguage = language;
    this.russian = language === 'ru';
    this.translate.use(language);
    this.languageMenuOpen = false;
  }

  @HostListener('document:click')
  closeLanguageMenu(): void {
    this.languageMenuOpen = false;
  }

  showLoginBlock() {
    this.dialog = this.dialogService.open(AuthComponent, {
      width: '560px',
      contentStyle: {
        overflow: 'hidden',
        'max-height': '90vh'
      }
    });
  }

  loginSuccess() {
    this.messageService.add({severity: 'success', summary: this.pipe.transform('Success'), detail: this.pipe.transform('Authorized')});
    this.dialog.close();
    this.loggedIn = true;
    this.sessionStore.setSession(true, this.login ?? '');
    this.authApi.setOnline().subscribe();
    this.startOnlineHeartbeat();
    this.initializeWebsockets();
    this.router.navigateByUrl('main');
  }

  logout() {
    this.authApi.setOffline().subscribe();
    this.authApi.logout().subscribe();
    this.loggedIn = false;
    this.sessionStore.clearSession();
    this.stopOnlineHeartbeat();
    this.router.navigateByUrl('start');
    this.cookieService.delete('loggedIn');
    this.cookieService.delete('username');
    this.messageService.add({severity: 'success', summary: this.pipe.transform('Success'), detail: this.pipe.transform('Logged out')});
  }

  openHistoryDialog(): void {
    this.dialog = this.dialogService.open(HistoryComponent, {
      width: '980px',
      height: '640px',
      closable: false
    });
  }

  ngOnDestroy(): void {
    if (this.loggedIn) {
      this.authApi.setOffline().subscribe();
    }
    this.stopOnlineHeartbeat();
  }

  initializeWebsockets(): void {
    this.stompClient = this.wsGateway.createClient();
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/user/invite', (response) => {
        const message: string = response.body; // format: {pvp/pve}:{sender-name}
        that.fightService.type = message.substring(0, 3);
        that.fightService.author = message.substring(4, message.lastIndexOf(':'));
        that.fightService.id = Number.parseInt(message.substring(
          message.lastIndexOf(':') + 1), 10);
        that.fightService.valuesSet = true;
        that.dialog = that.dialogService.open(RoomComponent, {
          width: '200px',
          height: '200px'
        });
      });
      that.stompClient.subscribe('/user/start', (response) => {
        const message = response.body;
        const id = message.substring(message.indexOf(':') + 1);
        that.fightService.id = Number.parseInt(id, 10);
        console.log('Fight started: ' + message);
        that.router.navigateByUrl('fight/' + that.fightService.type + '/' + id);
        that.dialog.close();
      });
    });
  }

  private startOnlineHeartbeat(): void {
    if (this.onlineHeartbeatId) {
      return;
    }
    this.onlineHeartbeatId = setInterval(() => {
      if (this.loggedIn) {
        this.authApi.setOnline().subscribe();
      }
    }, 120000);
  }

  private stopOnlineHeartbeat(): void {
    if (!this.onlineHeartbeatId) {
      return;
    }
    clearInterval(this.onlineHeartbeatId);
    this.onlineHeartbeatId = null;
  }

}
