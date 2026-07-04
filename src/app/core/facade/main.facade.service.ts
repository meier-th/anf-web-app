import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MessageService} from 'primeng/api';
import {CookieService} from 'ngx-cookie-service';
import {CompatClient} from '@stomp/stompjs';
import {AuthComponent} from '../../auth/auth.component';
import {RoomComponent} from '../../room/room.component';
import {TranslateService} from '../../services/translate.service';
import {TranslatePipe} from '../../services/translate.pipe';
import {AuthApiService} from '../api/auth-api.service';
import {SessionStore} from '../state/session.store';
import {InviteRealtimeService} from '../realtime/invite-realtime.service';
import {FightApiService} from '../api/fight-api.service';
import {FightService} from '../../services/fight/fight.service';
import {APP_MESSAGES, APP_TIMINGS, DIALOG_SIZES} from '../constants/app.constants';

@Injectable()
export class MainFacadeService {
  loggedIn = false;
  login = '';
  dialog: DynamicDialogRef | undefined;
  russian = false;
  display = false;
  showSurrenderConfirm = false;
  languageMenuOpen = false;
  currentLanguage: 'en' | 'ru' = 'en';
  private stompClient: CompatClient | undefined;
  private onlineHeartbeatId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    private dialogService: DialogService,
    private cookieService: CookieService,
    private authApi: AuthApiService,
    private messageService: MessageService,
    private fightService: FightService,
    private translate: TranslateService,
    private pipe: TranslatePipe,
    private sessionStore: SessionStore,
    private inviteRealtime: InviteRealtimeService,
    private fightApi: FightApiService
  ) {}

  init(): void {
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
      }, () => {
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

  destroy(): void {
    if (this.loggedIn) {
      this.authApi.setOffline().subscribe();
    }
    this.inviteRealtime.disconnect(this.stompClient);
    this.stopOnlineHeartbeat();
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

  closeLanguageMenu(): void {
    this.languageMenuOpen = false;
  }

  showLoginBlock() {
    this.dialog = this.dialogService.open(AuthComponent, {
      width: DIALOG_SIZES.auth.width,
      data: {
        onLoginSuccess: (username: string) => this.loginSuccess(username),
        onRegistrationSession: (username: string) => this.onRegistrationSession(username)
      },
      contentStyle: {
        overflow: 'hidden',
        'max-height': '90vh'
      }
    });
  }

  loginSuccess(username?: string) {
    if (username) {
      this.login = username;
    }
    this.messageService.add({
      severity: 'success',
      summary: this.pipe.transform(APP_MESSAGES.toastSuccess),
      detail: this.pipe.transform('Authorized')
    });
    this.dialog?.close();
    this.loggedIn = true;
    this.sessionStore.setSession(true, this.login ?? '');
    this.authApi.setOnline().subscribe();
    this.startOnlineHeartbeat();
    this.initializeWebsockets();
    this.router.navigateByUrl('main');
  }

  onRegistrationSession(username: string): void {
    this.loggedIn = true;
    this.login = username;
    this.sessionStore.setSession(true, username);
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
    this.messageService.add({
      severity: 'success',
      summary: this.pipe.transform(APP_MESSAGES.toastSuccess),
      detail: this.pipe.transform('Logged out')
    });
  }

  initializeWebsockets(): void {
    this.inviteRealtime.disconnect(this.stompClient);
    this.stompClient = this.inviteRealtime.connect((message: string) => {
      const firstSeparator = message.indexOf(':');
      const lastSeparator = message.lastIndexOf(':');
      this.fightService.type = message.substring(0, firstSeparator);
      this.fightService.author = message.substring(firstSeparator + 1, lastSeparator);
      this.fightService.id = message.substring(lastSeparator + 1);
      this.fightService.valuesSet = true;
      this.dialog = this.dialogService.open(RoomComponent, {
        width: DIALOG_SIZES.room.width,
        height: DIALOG_SIZES.room.height
      });
    }, (message: string) => {
      const parts = message.split(':');
      const mode = parts.length >= 3 ? parts[0] : this.fightService.type;
      const id = parts.length >= 3
        ? parts[2]
        : (parts.length === 2 ? parts[1] : message);
      if (mode) {
        const normalized = mode.toLowerCase();
        this.fightService.type = normalized.includes('pvp') ? 'pvp' : 'pve';
      } else {
        this.fightService.type = 'pvp';
      }
      this.fightService.valuesSet = true;
      this.fightService.id = id;
      this.router.navigateByUrl('fight/' + this.fightService.type + '/' + id);
      this.dialog?.close();
    });
  }

  isFightRoute(): boolean {
    return this.router.url.startsWith('/fight/');
  }

  onPrimaryAction(): void {
    if (!this.isFightRoute()) {
      this.router.navigateByUrl('main');
      return;
    }
    this.showSurrenderConfirm = true;
  }

  cancelSurrenderConfirm(): void {
    this.showSurrenderConfirm = false;
  }

  confirmSurrender(): void {
    this.showSurrenderConfirm = false;
    this.surrenderCurrentFight();
  }

  private surrenderCurrentFight(): void {
    const fightUuid = this.getCurrentFightUuid();
    if (!fightUuid) {
      this.messageService.add({
        severity: 'error',
        summary: this.pipe.transform(APP_MESSAGES.toastError),
        detail: this.pipe.transform(APP_MESSAGES.fightNotFound)
      });
      return;
    }
    this.fightApi.surrender(fightUuid).subscribe({
      next: () => {
        this.display = false;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.pipe.transform(APP_MESSAGES.toastError),
          detail: this.pipe.transform(APP_MESSAGES.unableToSurrender)
        });
      }
    });
  }

  private getCurrentFightUuid(): string {
    const segments = this.router.url.split('/').filter((segment) => segment.length > 0);
    if (segments.length >= 3 && segments[0] === 'fight') {
      return segments[2];
    }
    return this.fightService.id ?? '';
  }

  private startOnlineHeartbeat(): void {
    if (this.onlineHeartbeatId) {
      return;
    }
    this.onlineHeartbeatId = setInterval(() => {
      if (this.loggedIn) {
        this.authApi.setOnline().subscribe();
      }
    }, APP_TIMINGS.onlineHeartbeatMs);
  }

  private stopOnlineHeartbeat(): void {
    if (!this.onlineHeartbeatId) {
      return;
    }
    clearInterval(this.onlineHeartbeatId);
    this.onlineHeartbeatId = null;
  }
}
