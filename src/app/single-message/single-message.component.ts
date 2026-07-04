import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {Message} from '../classes/message';
import {User} from '../classes/user';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MessageApiService} from '../core/api/message-api.service';
import {SocialRealtimeService} from '../core/realtime/social-realtime.service';
import {CompatClient} from '@stomp/stompjs';
import { FormsModule } from '@angular/forms';
import { Bind } from 'primeng/bind';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-single-message',
    templateUrl: './single-message.component.html',
    styleUrls: ['./single-message.component.less'],
    imports: [FormsModule, Bind, InputText, Button, TranslatePipe]
})
export class SingleMessageComponent implements OnInit, OnDestroy, AfterViewChecked {

  input = '';
  username = '';
  login = '';
  messages: Message[] = [];
  loaded = false;
  private stompClient: CompatClient;
  private shouldScrollToBottom = false;

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  constructor(private messageApi: MessageApiService,
    private socialRealtime: SocialRealtimeService,
    private dialogRef: DynamicDialogRef,
    private dialogConfig: DynamicDialogConfig) { }

  ngOnInit() {
    this.username = this.dialogConfig.data?.username ?? '';
    this.messageApi.getProfile().subscribe(user => {
      this.login = user.login;
      this.loadDialogue();
    });
    this.initializeWebSocketConnection();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  send(): void {
    const text = this.input.trim();
    if (!text || !this.username) {
      return;
    }
    this.messageApi.sendMessage(this.username, text).subscribe();

    const msg = new Message();
    const tempSendr = new User();
    tempSendr.login = this.login;
    const tempRecvr = new User();
    tempRecvr.login = this.username;
    msg.receiver = tempRecvr;
    msg.sender = tempSendr;
    msg.message = text;
    msg.isRead = false;
    msg.sendingDate = new Date();
    this.messages.push(msg);
    this.messages = this.sortMessages(this.messages);
    this.input = '';
    this.shouldScrollToBottom = true;
  }

  close(): void {
    this.dialogRef.close();
  }

  isMine(message: Message): boolean {
    return message?.sender?.login === this.login;
  }

  private loadDialogue(): void {
    this.messageApi.getDialogue(this.username).subscribe((data) => {
      this.messages = this.sortMessages(data ?? []);
      this.markInterlocutorMessagesAsRead(this.messages);
      this.loaded = true;
      this.shouldScrollToBottom = true;
    });
  }

  private initializeWebSocketConnection(): void {
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeUserMessages(client, (str) => {
        const i = str.indexOf(':');
        if (i < 0) {
          return;
        }
        const author = str.substring(0, i);
        const msgText = str.substring(i + 1);
        if (author !== this.username) {
          return;
        }
        const msg = new Message();
        const sender = new User();
        sender.login = author;
        const receiver = new User();
        receiver.login = this.login;
        msg.sender = sender;
        msg.receiver = receiver;
        msg.message = msgText;
        msg.isRead = true;
        msg.sendingDate = new Date();
        this.messages.push(msg);
        this.messages = this.sortMessages(this.messages);
        this.shouldScrollToBottom = true;
        this.markUnreadByInterlocutorAsRead();
      });
    });
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }

  ngOnDestroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
  }

  private markUnreadByInterlocutorAsRead(): void {
    this.messageApi.getUnreadMessages()
      .subscribe(unread => this.markInterlocutorMessagesAsRead(unread ?? []));
  }

  private markInterlocutorMessagesAsRead(messages: Message[]): void {
    messages
      .filter(message => message?.sender?.login === this.username && !message.isRead)
      .forEach(message => {
        if (message.message_id == null) {
          return;
        }
        this.messageApi.markMessageAsRead(message.message_id).subscribe();
      });
  }

  private sortMessages(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      const aTime = a?.sendingDate ? new Date(a.sendingDate).getTime() : 0;
      const bTime = b?.sendingDate ? new Date(b.sendingDate).getTime() : 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      const aId = a?.message_id ?? 0;
      const bId = b?.message_id ?? 0;
      return aId - bId;
    });
  }

}
