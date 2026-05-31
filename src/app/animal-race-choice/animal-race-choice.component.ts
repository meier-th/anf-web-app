import { Component, OnInit, Injector } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {ProfilePageComponent} from '../profile-page/profile-page.component';

@Component({
  selector: 'app-animal-race-choice',
  standalone: false,
  templateUrl: './animal-race-choice.component.html',
  styleUrls: ['./animal-race-choice.component.less']
})
export class AnimalRaceChoiceComponent implements OnInit {

  private parent = this.injector.get(ProfilePageComponent);

  constructor(private http: HttpClient, private injector: Injector) { }

  ngOnInit() {
  }

  choose(type: string): void {
    var raceName: string;
    if (type === 'fat')
      raceName = 'Veseliba';
    else if (type === 'dmg')
      raceName = 'Bojajumus';
    else if (type === 'blc')
      raceName = 'Lidzsvaru';
    else 
      raceName = 'Bugurt';
    this.http.post<string>('http://localhost:8080/fight/animals/my', 
      new HttpParams().append('racename', raceName), {headers:
        new HttpHeaders(
          {
            'Content-Type': 'application/x-www-form-urlencoded'
          }), withCredentials: true}).subscribe(res => {
            this.parent.user.character.animalRace = raceName;
            this.parent.dialog.close();
          });
  }

}
