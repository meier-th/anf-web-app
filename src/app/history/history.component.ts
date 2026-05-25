import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../classes/user';
import { HistoryFight } from '../classes/history-fight';
import { PVPFight } from '../classes/pvpfight';

@Component({
  selector: 'app-history',
  standalone: false,
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.less']
})
export class HistoryComponent implements OnInit {

  user: User;
  fights: HistoryFight[] = [];
  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.http.get<User>('http://localhost:31480/profile', {withCredentials: true})
      .subscribe(data => {
        this.user = data;
        this.user.character.fights.forEach(fight => {
          var histrecord: HistoryFight = new HistoryFight();
          histrecord.ratingCh = 0;
          histrecord.type = 'PVE';
          histrecord.result = fight.result;
          if (histrecord.result.toLowerCase() === 'won')
          histrecord.result = 'Win';
          histrecord.date = fight.fight.fight_date;
          histrecord.rival = fight.fight.boss.name;
          histrecord.xpCh = fight.experience;
          this.fights.push(histrecord);
        });
        var pvps: PVPFight[] = [];
      this.http.get<PVPFight[]>('http://localhost:31480/profile/pvphistory', {withCredentials: true})
        .subscribe(data => {
          pvps = data;
          pvps.forEach(fight => {
            var histrecord: HistoryFight = new HistoryFight();
            histrecord.date = fight.date;
            histrecord.ratingCh = fight.ratingCh;
            histrecord.result = fight.result;
            histrecord.rival = fight.rival;
            histrecord.type = 'PVP';
            histrecord.xpCh = 0;
            this.fights.push(histrecord);
          });
        });
        this.fights.sort((fight1, fight2) => {
          if (fight1.date > fight2.date)
            return -1;
          else
           return 1;
        });
      });
      
  }

}
