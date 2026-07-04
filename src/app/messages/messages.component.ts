import {Component, OnDestroy, OnInit} from '@angular/core';
import {Message} from '../classes/message';
import {User} from '../classes/user';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {MessageApiService} from '../core/api/message-api.service';
import {SocialRealtimeService} from '../core/realtime/social-realtime.service';
import {CompatClient} from '@stomp/stompjs';
import {Router} from '@angular/router';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-messages',
    templateUrl: './messages.component.html',
    styleUrls: ['./messages.component.less'],
    animations: [
        trigger('load', [
            state('hidden', style({
                bottom: '-20%',
                display: 'none',
                opacity: '0.3'
            })),
            state('default', style({})),
            transition('hidden => default', [
                animate('0.3s')
            ])
        ])
    ],
    imports: [TranslatePipe]
})
export class MessagesComponent implements OnInit, OnDestroy {
  user: User;
  inMessages: Message[];
  outMessages: Message[];
  dialogues: string[];
  private stompClient: CompatClient;
  loaded = false;

  constructor(private messageApi: MessageApiService, private socialRealtime: SocialRealtimeService,
              private router: Router) {
  }

  ngOnInit() {
    this.dialogues = [];
    this.messageApi.getDialogs().subscribe(data => {
      this.dialogues = data;
      this.loaded = true;
    });
    this.initializeWebSocketConnection();
  }

  initializeWebSocketConnection() {
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeUserMessages(client, (str) => {
        const i = str.indexOf(':');
        const author = str.substring(0, i);
        let exists = 0;
        this.dialogues.forEach(dial => {
          if (dial === author) {
            exists = 1;
          }
        });
        if (exists === 0) {
          this.dialogues.push(author);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
  }

  openDialogue(dialogue: string): void {
    this.router.navigateByUrl('dialogue/' + dialogue);
  }

}
