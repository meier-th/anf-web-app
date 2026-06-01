import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SingleMessageService } from '../services/single-message.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import {ApiConfigService} from '../core/config/api-config.service';
import {Message} from '../classes/message';
import {User} from '../classes/user';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import SockJS from 'sockjs-client';
import {Stomp} from '@stomp/stompjs';

@Component({
  selector: 'app-single-message',
  standalone: false,
  templateUrl: './single-message.component.html',
  styleUrls: ['./single-message.component.less']
})
export class SingleMessageComponent implements OnInit, OnDestroy, AfterViewChecked {

  input = '';
  username = '';
  login = '';
  messages: Message[] = [];
  loaded = false;
  private stompClient: any;
  private shouldScrollToBottom = false;

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  constructor(private serv: SingleMessageService,
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private dialogRef: DynamicDialogRef,
    private dialogConfig: DynamicDialogConfig) { }

  ngOnInit() {
    this.username = this.dialogConfig.data?.username ?? this.serv.username;
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true}).subscribe(user => {
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
    this.http.post(this.apiConfig.buildUrl('/profile/messages'), null, {
      withCredentials: true,
      responseType: 'text',
      params: new HttpParams()
        .append('message', text)
        .append('receiver', this.username)
    }).subscribe();

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
    this.http.get<Message[]>(this.apiConfig.buildUrl('/profile/messages/dialog'), {
      withCredentials: true,
      params: new HttpParams().append('secondName', this.username)
    }).subscribe((data) => {
      this.messages = this.sortMessages(data ?? []);
      this.markInterlocutorMessagesAsRead(this.messages);
      this.loaded = true;
      this.shouldScrollToBottom = true;
    });
  }

  private initializeWebSocketConnection(): void {
    const ws = new SockJS(this.apiConfig.buildUrl('/socket'));
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function () {
      that.stompClient.subscribe('/user/msg', (message) => {
        const str = message.body as string;
        const i = str.indexOf(':');
        if (i < 0) {
          return;
        }
        const author = str.substring(0, i);
        const msgText = str.substring(i + 1);
        if (author !== that.username) {
          return;
        }
        const msg = new Message();
        const sender = new User();
        sender.login = author;
        const receiver = new User();
        receiver.login = that.login;
        msg.sender = sender;
        msg.receiver = receiver;
        msg.message = msgText;
        msg.isRead = true;
        msg.sendingDate = new Date();
        that.messages.push(msg);
        that.messages = that.sortMessages(that.messages);
        that.shouldScrollToBottom = true;
        that.markUnreadByInterlocutorAsRead();
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
    if (this.stompClient?.connected) {
      this.stompClient.disconnect(() => {});
    }
  }

  private markUnreadByInterlocutorAsRead(): void {
    this.http.get<Message[]>(this.apiConfig.buildUrl('/profile/messages/unread'), {withCredentials: true})
      .subscribe(unread => this.markInterlocutorMessagesAsRead(unread ?? []));
  }

  private markInterlocutorMessagesAsRead(messages: Message[]): void {
    messages
      .filter(message => message?.sender?.login === this.username && !message.isRead)
      .forEach(message => {
        if (message.message_id == null) {
          return;
        }
        this.http.post(
          this.apiConfig.buildUrl(`/profile/messages/${message.message_id}/read`),
          null,
          {withCredentials: true, responseType: 'text'}
        ).subscribe();
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
