import {Component, OnInit} from '@angular/core';
import {FightService} from '../services/fight/fight.service';
import {HttpClient} from '@angular/common/http';
import {ApiConfigService} from '../core/config/api-config.service';

@Component({
  selector: 'app-room',
  standalone: false,
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.less']
})
export class RoomComponent implements OnInit {
  id: string;
  type: string;
  author: string;
  accepted = false;

  constructor(
    private fightService: FightService,
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
  }

  ngOnInit() {
    this.id = this.fightService.id;
    this.type = this.fightService.type;
    this.author = this.fightService.author;
  }

  join() {
    this.accepted = true;
    this.http.post(this.apiConfig.buildUrl(`/fight/lobbies/${this.id}/join`), null, {
      withCredentials: true
    }).subscribe();
  }

}
