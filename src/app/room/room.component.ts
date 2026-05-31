import {Component, OnInit} from '@angular/core';
import {FightService} from '../services/fight/fight.service';
import {HttpClient, HttpParams} from '@angular/common/http';

@Component({
  selector: 'app-room',
  standalone: false,
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.less']
})
export class RoomComponent implements OnInit {
  id: number;
  type: string;
  author: string;
  accepted = false;

  constructor(private fightService: FightService, private http: HttpClient) {
  }

  ngOnInit() {
    this.id = this.fightService.id;
    this.type = this.fightService.type;
    this.author = this.fightService.author;
  }

  join() {
    this.accepted = true;
    this.http.get('http://localhost:8080/fight/join', {
      withCredentials: true,
      params: new HttpParams()
        .append('author', this.author)
        .append('id', this.id.toString())
    }).subscribe();
  }

}
