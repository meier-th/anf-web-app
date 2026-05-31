import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {User} from '../classes/user';
import { Spell } from '../classes/spell';

@Component({
  selector: 'app-spells',
  standalone: false,
  templateUrl: './spells.component.html',
  styleUrls: ['./spells.component.less']
})
export class SpellsComponent implements OnInit {

  user: User;
  earthHandling: number;
  waterHandling: number;
  fireHandling: number;
  airHandling: number;
  earth: Spell = new Spell(1, 'Earth Strike', 25, 12, 7, 3);
  water: Spell = new Spell(5, 'Water Strike', 40, 20, 10, 4);
  fire: Spell = new Spell(12, 'Fire Strike', 90, 40, 15, 5);
  air: Spell = new Spell(25, 'Air Strike', 150, 70, 20, 10);
  freePoints: number;

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.http.get<User>('http://localhost:8080/profile', {withCredentials: true})
      .subscribe(data => {
        this.user = data;
        const airSpellHandling = this.user.character.spellsKnown.find(sh => sh.spellUse.name === 'Air Strike');
        if (airSpellHandling === undefined) {
          this.airHandling = 0;
        } else {
          this.airHandling = airSpellHandling.spellLevel;
        }

        const earthSpellHandling = this.user.character.spellsKnown.find(sh => sh.spellUse.name === 'Earth Strike');
        if (earthSpellHandling === undefined) {
          this.earthHandling = 0;
        } else {
          this.earthHandling = earthSpellHandling.spellLevel;
        }

        const waterSpellHandling = this.user.character.spellsKnown.find(sh => sh.spellUse.name === 'Water Strike');
        if (waterSpellHandling === undefined) {
          this.waterHandling = 0;
        } else {
          this.waterHandling = waterSpellHandling.spellLevel;
        }

        const fireSpellHandling = this.user.character.spellsKnown.find(sh => sh.spellUse.name === 'Fire Strike');
        if (fireSpellHandling === undefined) {
          this.fireHandling = 0;
        } else {
          this.fireHandling = fireSpellHandling.spellLevel;
        }
        this.freePoints = this.user.stats.upgradePoints;
      });

  }

  learnOrUpgrade(spell: string): void {
    this.http.post<string>('http://localhost:8080/fight/spell/my',
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
    this.freePoints--;
  }

}
