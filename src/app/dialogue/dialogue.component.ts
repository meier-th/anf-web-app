import {Component, OnDestroy, OnInit} from '@angular/core';
import {Message} from '../classes/message';
import {User} from '../classes/user';
import {ActivatedRoute, Router} from '@angular/router';
import {MessageApiService} from '../core/api/message-api.service';
import {SocialRealtimeService} from '../core/realtime/social-realtime.service';
import {CompatClient} from '@stomp/stompjs';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-dialogue',
    templateUrl: './dialogue.component.html',
    styleUrls: ['./dialogue.component.less'],
    imports: [Bind, Button, FormsModule, InputText, TranslatePipe]
})
export class DialogueComponent implements OnInit, OnDestroy {

  messages: Message[];
  interlocutor: string;
  input: string;
  login: string;
  private stompClient: CompatClient;

  constructor(private route: ActivatedRoute, private messageApi: MessageApiService,
              private socialRealtime: SocialRealtimeService, private router: Router) {
  }

  ngOnInit() {
    this.messageApi.getProfile().subscribe(data => {
      this.login = data.login;
    });
    this.interlocutor = this.route.snapshot.paramMap.get('login') ?? '';
    this.messageApi.getDialogue(this.interlocutor).subscribe((data) => {
      this.messages = data;
    });
    this.initializeWebSocketConnection();
  }


  send() {
    if (this.input.length === 0) {
      return;
    }
    this.messageApi.sendMessage(this.interlocutor, this.input).subscribe();
    const msg = new Message();
    const tempSendr = new User();
    tempSendr.login = this.login;
    const tempRecvr = new User();
    tempRecvr.login = this.interlocutor;
    msg.receiver = tempRecvr;
    msg.sender = tempSendr;
    msg.message = this.input;
    msg.isRead = false;
    this.messages.push(msg);
    this.input = '';
  }

  initializeWebSocketConnection() {
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeUserMessages(client, (str) => {

        const i = str.indexOf(':');
        const author = str.substring(0, i);
        if (author === this.interlocutor) {
          const msg = str.substring(i + 1, str.length);
          const messg = new Message();
          const tempSendr = new User();
          tempSendr.login = this.login;
          const tempRecvr = new User();
          tempRecvr.login = this.interlocutor;
          messg.sender = tempRecvr;
          messg.receiver = tempSendr;
          messg.message = msg;
          messg.isRead = true;
          this.messages.push(messg);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
  }

  goBack(): void {
    this.router.navigateByUrl('messages');
  }

}
