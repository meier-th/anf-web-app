import { Component, OnInit, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../classes/user';
import { HistoryFight } from '../classes/history-fight';
import { PVPFight } from '../classes/pvpfight';
import {ApiConfigService} from '../core/config/api-config.service';
import {DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-history',
  standalone: false,
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.less']
})
export class HistoryComponent implements OnInit {

  user: User | null = null;
  loaded = false;
  fights: HistoryFight[] = [];
  constructor(private http: HttpClient, private apiConfig: ApiConfigService,
              @Optional() public dialogRef: DynamicDialogRef | null) { }

  ngOnInit() {
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true})
      .subscribe(data => {
        this.user = data;
        this.user?.character?.fights?.forEach(fight => {
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
      this.http.get<PVPFight[]>(this.apiConfig.buildUrl('/profile/pvphistory'), {withCredentials: true})
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
          this.sortFights();
          this.loaded = true;
        });
      });
      
  }

  close(): void {
    this.dialogRef?.close();
  }

  private sortFights(): void {
    this.fights.sort((fight1, fight2) => {
      const t1 = fight1?.date ? new Date(fight1.date).getTime() : 0;
      const t2 = fight2?.date ? new Date(fight2.date).getTime() : 0;
      return t2 - t1;
    });
  }

}
