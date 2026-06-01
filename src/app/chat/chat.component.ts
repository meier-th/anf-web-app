import {Component, OnInit} from '@angular/core';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {ChatMessage} from '../classes/chat-message';
import {HttpClient} from '@angular/common/http';
import {User} from '../classes/user';
import {ApiConfigService} from '../core/config/api-config.service';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.less']
})
export class ChatComponent implements OnInit {

  user: User | null = null;
  messages: ChatMessage[] = [];
  private socketUrls: string[];
  private socketUrlIndex = 0;
  private stompClient;
  stompConnected = false;
  private connecting = false;
  private pendingMessages: string[] = [];
  input = '';
  asSystem: boolean = false;
  admin: boolean = false;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.socketUrls = this.buildSocketUrls();
  }

  initializeWebSocketConnection() {
    if (this.connecting || this.stompConnected) {
      return;
    }
    const socketUrl = this.socketUrls[this.socketUrlIndex] ?? this.socketUrls[0];
    const ws = new SockJS(socketUrl);
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompConnected = false;
    this.connecting = true;
    this.stompClient.connect({}, function () {
      that.stompConnected = true;
      that.connecting = false;
      that.stompClient.subscribe('/chat', (message) => {
        const str = message.body;
        const i = str.indexOf(':');
        if (i < 0) {
          return;
        }
        const author = str.substring(0, i);
        const msg = str.substring(i + 1, str.length);
        const mes = new ChatMessage(author, msg);
        that.messages.push(mes);
        // console.log(message.body);
      });
      that.flushPendingMessages();
    }, function () {
      that.stompConnected = false;
      that.connecting = false;
      that.socketUrlIndex = (that.socketUrlIndex + 1) % that.socketUrls.length;
      setTimeout(() => that.initializeWebSocketConnection(), 1500);
    });
  }

  send(): void {
    const normalizedInput = (this.input ?? '').trim();
    if (!normalizedInput) {
      return;
    }

    if (!this.user && !(this.admin && this.asSystem)) {
      return;
    }

    let txt = `${this.user?.login}: ${normalizedInput}`;
    if (this.admin && this.asSystem) {
      txt = `SYSTEM: ${normalizedInput}`;
    }

    if (!this.stompClient || !this.stompConnected || !this.stompClient.connected) {
      this.pendingMessages.push(txt);
      this.messages.push(new ChatMessage('SYSTEM', 'Connecting to chat... your message will be sent automatically.'));
      this.initializeWebSocketConnection();
      this.input = '';
      return;
    }

    this.stompClient.send('/app/send/message', {}, txt);
    this.input = '';
    // this.messages.push(text);
  }

  ngOnInit() {
    this.initializeWebSocketConnection();
    const msg = new ChatMessage('SYSTEM', 'Welcome to the chat!');
    this.messages.push(msg);
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true}).subscribe(data => {
      this.user = data;
      this.user.roles.forEach(role => console.log(role));
      if (this.user.roles.map(role => role.role).includes('ADMIN')) {
        this.admin = true;
      }
    });
  }

  private flushPendingMessages(): void {
    if (!this.stompClient || !this.stompConnected || !this.stompClient.connected) {
      return;
    }
    while (this.pendingMessages.length > 0) {
      const queuedMessage = this.pendingMessages.shift();
      if (queuedMessage) {
        this.stompClient.send('/app/send/message', {}, queuedMessage);
      }
    }
  }

  private buildSocketUrls(): string[] {
    const candidates = [
      this.apiConfig.buildUrl('/socket'),
      '/socket',
      `${window.location.protocol}//${window.location.host}/socket`,
      'http://localhost:8080/socket'
    ];
    return [...new Set(candidates)];
  }

}
