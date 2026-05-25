import {Component, OnInit} from '@angular/core';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {ChatMessage} from '../classes/chat-message';
import {HttpClient} from '@angular/common/http';
import {User} from '../classes/user';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.less']
})
export class ChatComponent implements OnInit {

  user: User;
  messages: ChatMessage[];
  private subscriptionURL = 'http://localhost:31480/socket';
  private stompClient;
  input: string;
  asSystem: boolean = false;
  admin: boolean = false;

  constructor(private http: HttpClient) {
    this.initializeWebSocketConnection();
  }

  initializeWebSocketConnection() {
    const ws = new SockJS(this.subscriptionURL);
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/chat', (message) => {
        const str = message.body;
        const i = str.indexOf(':');
        const author = str.substring(0, i);
        const msg = str.substring(i + 1, str.length);
        const mes = new ChatMessage(author, msg);
        that.messages.push(mes);
        // console.log(message.body);
      });
      
    });
    
  }

  send(): void {
    var txt = this.user.login + ': ' + this.input;
    if (this.admin && this.asSystem)
      txt = 'SYSTEM: '+this.input;
    this.stompClient.send('/app/send/message', {}, txt);
    this.input = '';
    // this.messages.push(text);
  }

  ngOnInit() {
    this.messages = [];
    const msg = new ChatMessage('SYSTEM', 'Welcome to the chat!');
    this.messages.push(msg);
    this.http.get<User>('http://localhost:31480/profile', {withCredentials: true}).subscribe(data => {
      this.user = data;
      this.user.roles.forEach(role => console.log(role));
      if (this.user.roles.map(role => role.role).includes('ADMIN')) 
        this.admin = true;
    });
  }

}
