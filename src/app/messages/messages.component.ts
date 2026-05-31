import {Component, Injector, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Message} from '../classes/message';
import {User} from '../classes/user';
import {MainComponent} from '../main/main.component';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {animate, state, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'app-messages',
  standalone: false,
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.less'],
  animations: [
    trigger('load', [
      state('hidden', style({
          bottom: '-20%',
          display: 'none',
          opacity: '0.3'
        })),
      state('default', style({})
      ),
      transition('hidden => default', [
        animate('0.3s')
      ])]
    )
  ]
})
export class MessagesComponent implements OnInit {
  user: User;
  inMessages: Message[];
  outMessages: Message[];
  dialogues: string[];
  private stompClient;
  parent = this.injector.get(MainComponent);
  loaded = false;

  constructor(private http: HttpClient, private injector: Injector) {
  }

  ngOnInit() {
    this.dialogues = [];
    // this.http.get<User>('http://localhost:8080/profile', {withCredentials: true})
    //   .subscribe(data => this.user = data);
    this.http.get<string[]>('http://localhost:8080/profile/dialogs',
      {withCredentials: true}).subscribe(data => {
      this.dialogues = data;
      this.loaded = true;
    });
    this.initializeWebSocketConnection();
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
        // var msg = str.substring(i+1, str.length);
        // alert(msg);
        let exists = 0;
        that.dialogues.forEach(dial => {
          if (dial === author) {
            exists = 1;
          }
        });
        if (exists === 0) {
          that.dialogues.push(author);
        }
        // console.log(message.body);
      });
    });
  }

}
