import {Component, OnInit} from '@angular/core';
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

@Component({
  selector: 'app-main',
  standalone: false,
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.less'],
  providers: [DialogService, ConfirmationService]
})
export class MainComponent implements OnInit {
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
      }, (response: { authorized: boolean, login: string }) => {
        this.loggedIn = false;
        this.sessionStore.clearSession();
        this.cookieService.delete('loggedIn');
        this.cookieService.delete('username');
        this.router.navigateByUrl('start');
      });
    }
    this.initializeWebsockets();
  }

  changeLanguage(): void {
    if (this.russian) {
      this.russian = false;
      this.translate.use('en');
    } else {
      this.russian = true;
      this.translate.use('ru');
    }
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
    this.initializeWebsockets();
  }

  logout() {
    this.authApi.logout().subscribe();
    this.loggedIn = false;
    this.sessionStore.clearSession();
    this.router.navigateByUrl('start');
    this.cookieService.delete('loggedIn');
    this.cookieService.delete('username');
    this.messageService.add({severity: 'success', summary: this.pipe.transform('Success'), detail: this.pipe.transform('Logged out')});
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

}
