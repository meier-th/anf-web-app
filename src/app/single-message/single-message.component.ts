import { Component, OnInit, Injector } from '@angular/core';
import { FriendsPageComponent } from '../friends-page/friends-page.component';
import { UsersListComponent } from '../users-list/users-list.component';
import { SingleMessageService } from '../services/single-message.service';
import { HttpClient, HttpParams } from '@angular/common/http';

@Component({
  selector: 'app-single-message',
  standalone: false,
  templateUrl: './single-message.component.html',
  styleUrls: ['./single-message.component.less']
})
export class SingleMessageComponent implements OnInit {

  input = '';
  username = '';
  constructor(private serv: SingleMessageService,
    private http: HttpClient) { }

  ngOnInit() {
    this.username = this.serv.username;
  }

  confirm(): void {
    this.http.post('http://localhost:31480/profile/messages', null, {
      withCredentials: true,
      params: new HttpParams()
        .append('message', this.input)
        .append('receiver', this.username)
    }).subscribe();
    this.serv.exit();
  }

  cancel(): void {
    this.serv.exit();
  }

}
