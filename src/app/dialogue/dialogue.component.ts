import {Component, Injector, OnInit} from '@angular/core';
import {Message} from '../classes/message';
import {HttpClient, HttpParams} from '@angular/common/http';
import {MainComponent} from '../main/main.component';
import {User} from '../classes/user';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Component({
  selector: 'app-dialogue',
  standalone: false,
  templateUrl: './dialogue.component.html',
  styleUrls: ['./dialogue.component.less']
})
export class DialogueComponent implements OnInit {

  messages: Message[];
  parent = this.injector.get(MainComponent);
  interlocutor: string;
  input: string;
  login: string;
  private stompClient;

  constructor(private httpClient: HttpClient, private injector: Injector) {
  }

  ngOnInit() {
    this.httpClient.get<User>('http://localhost:8080/profile', {withCredentials: true}).subscribe(data => {
      this.login = data.login;
    });
    this.interlocutor = this.parent.router.url;
    this.interlocutor = this.interlocutor.substring(this.interlocutor.lastIndexOf('/') + 1);
    this.httpClient.get<Message[]>('http://localhost:8080/profile/messages/dialog', {
      withCredentials: true,
      params: new HttpParams().append('secondName', this.interlocutor)
    }).subscribe((data) => {
      this.messages = data;
    });
    this.initializeWebSocketConnection();
  }


  send() {
    if (this.input.length === 0) {
      return;
    }
    this.httpClient.post('http://localhost:8080/profile/messages', null, {
      withCredentials: true,
      params: new HttpParams()
        .append('message', this.input)
        .append('receiver', this.interlocutor)
    }).subscribe();
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
    const ws = new SockJS('http://localhost:8080/socket');
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/user/msg', (message) => {
        const str = message.body;

        const i = str.indexOf(':');
        const author = str.substring(0, i);
        console.log(that.login);
        if (author === that.interlocutor) {
          const msg = str.substring(i + 1, str.length);
          const messg = new Message();
          const tempSendr = new User();
          tempSendr.login = that.login;
          const tempRecvr = new User();
          tempRecvr.login = that.interlocutor;
          messg.sender = tempRecvr;
          messg.receiver = tempSendr;
          messg.message = msg;
          messg.isRead = true;
          that.messages.push(messg);
        }
      });
    });
  }

}
