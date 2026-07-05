import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CompatClient} from '@stomp/stompjs';
import {ApiConfigService} from '../config/api-config.service';
import {WebsocketGatewayService} from '../realtime/websocket-gateway.service';
import {ChatMessage} from '../../classes/chat-message';
import {User} from '../../classes/user';
import {APP_MESSAGES} from '../constants/app.constants';

type PendingChatMessage = {
  text: string;
};

@Injectable({
  providedIn: 'root'
})
export class ChatFacadeService {
  user: User | null = null;
  messages: ChatMessage[] = [];
  admin = false;
  private asSystem = false;

  private stompClient: CompatClient | null = null;
  private stompConnected = false;
  private acquired = false;
  private pendingMessages: PendingChatMessage[] = [];

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private wsGateway: WebsocketGatewayService
  ) {}

  setAsSystem(value: boolean): void {
    this.asSystem = value;
  }

  getAsSystem(): boolean {
    return this.asSystem;
  }

  init(): void {
    this.initializeWebSocketConnection();
    this.messages.push(new ChatMessage('SYSTEM', APP_MESSAGES.chatWelcome));
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true}).subscribe((data) => {
      this.user = data;
    });
    this.http.get<{ admin: boolean }>(this.apiConfig.buildUrl('/profile/isAdmin'), {withCredentials: true})
      .subscribe({
        next: (data) => {
          this.admin = !!data?.admin;
          if (!this.admin) {
            this.asSystem = false;
          }
        },
        error: () => {
          this.admin = false;
          this.asSystem = false;
        }
      });
  }

  dispose(): void {
    if (this.acquired) {
      this.wsGateway.release();
      this.acquired = false;
    }
    this.stompClient = null;
    this.stompConnected = false;
  }

  send(input: string): string {
    const normalizedInput = (input ?? '').trim();
    if (!normalizedInput || !this.user) {
      return input;
    }

    if (this.admin && this.asSystem) {
      this.http.post(this.apiConfig.buildUrl('/admin/chat'), normalizedInput, {
        withCredentials: true,
        responseType: 'text'
      }).subscribe({
        next: () => {},
        error: () => {
          this.messages.push(new ChatMessage('SYSTEM', APP_MESSAGES.chatSystemSendFailed));
        }
      });
      return '';
    }

    const txt = `${this.user.login}: ${normalizedInput}`;
    if (!this.stompConnected || !this.stompClient?.connected) {
      this.pendingMessages.push({text: txt});
      this.messages.push(new ChatMessage('SYSTEM', APP_MESSAGES.chatConnecting));
      this.initializeWebSocketConnection();
      return '';
    }

    this.stompClient.send('/app/send/message', {}, txt);
    return '';
  }

  private initializeWebSocketConnection(): void {
    if (this.acquired) {
      return;
    }
    this.acquired = true;
    this.stompClient = this.wsGateway.acquire((client) => {
      this.stompConnected = true;
      client.subscribe('/chat', (message) => {
        const str = message.body;
        const i = str.indexOf(':');
        if (i < 0) {
          return;
        }
        const author = str.substring(0, i);
        const msg = str.substring(i + 1, str.length);
        this.messages.push(new ChatMessage(author, msg));
      });
      this.flushPendingMessages();
    });
  }

  private flushPendingMessages(): void {
    if (!this.stompConnected || !this.stompClient?.connected) {
      return;
    }
    while (this.pendingMessages.length > 0) {
      const queuedMessage = this.pendingMessages.shift();
      if (queuedMessage?.text) {
        this.stompClient.send('/app/send/message', {}, queuedMessage.text);
      }
    }
  }
}
