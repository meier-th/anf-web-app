import { Component, OnInit, Optional } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {User} from '../classes/user';
import { Spell } from '../classes/spell';
import {ApiConfigService} from '../core/config/api-config.service';
import {Router} from '@angular/router';
import {DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-spells',
  standalone: false,
  templateUrl: './spells.component.html',
  styleUrls: ['./spells.component.less']
})
export class SpellsComponent implements OnInit {

  user: User | null = null;
  loaded = false;
  earthHandling = 0;
  waterHandling = 0;
  fireHandling = 0;
  airHandling = 0;
  earth: Spell = new Spell(1, 'Earth Strike', 25, 12, 7, 3);
  water: Spell = new Spell(5, 'Water Strike', 40, 20, 10, 4);
  fire: Spell = new Spell(12, 'Fire Strike', 90, 40, 15, 5);
  air: Spell = new Spell(25, 'Air Strike', 150, 70, 20, 10);
  freePoints = 0;

  constructor(private http: HttpClient, private apiConfig: ApiConfigService, private router: Router,
              @Optional() public dialogRef: DynamicDialogRef | null) { }

  ngOnInit() {
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true})
      .subscribe(data => {
        this.user = data;
        this.earthHandling = this.getHandlingLevel('Earth Strike');
        this.waterHandling = this.getHandlingLevel('Water Strike');
        this.fireHandling = this.getHandlingLevel('Fire Strike');
        this.airHandling = this.getHandlingLevel('Air Strike');
        this.freePoints = this.user.stats?.upgradePoints ?? 0;
        this.loaded = true;
      }, () => {
        this.router.navigateByUrl('start');
      });

  }

  learnOrUpgrade(spell: string): void {
    if (this.freePoints <= 0) {
      return;
    }
    this.http.post<string>(this.apiConfig.buildUrl('/fight/spell/my'),
    new HttpParams().set('spellname', spell),
      {
        headers:
          new HttpHeaders(
            {
              'Content-Type': 'application/x-www-form-urlencoded'
            }),
        withCredentials: true
      }).subscribe(() => {
    });
    if (spell === 'Earth Strike') {
      this.earthHandling++;
    } else if (spell === 'Water Strike') {
      this.waterHandling++;
         } else if (spell === 'Fire Strike') {
      this.fireHandling++;
         } else {
      this.airHandling++;
         }
    this.freePoints = Math.max(0, this.freePoints - 1);
  }

  get userLevel(): number {
    return this.user?.stats?.level ?? 0;
  }

  private getHandlingLevel(spellName: string): number {
    const spellHandling = this.user?.character?.spellsKnown?.find(sh => sh.spellUse?.name === spellName);
    return spellHandling?.spellLevel ?? 0;
  }

  close(): void {
    this.dialogRef?.close();
  }

}
