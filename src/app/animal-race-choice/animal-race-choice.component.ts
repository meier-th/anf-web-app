import {Component, OnInit} from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {ApiConfigService} from '../core/config/api-config.service';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-animal-race-choice',
    templateUrl: './animal-race-choice.component.html',
    styleUrls: ['./animal-race-choice.component.less'],
    imports: [Bind, Button, TranslatePipe]
})
export class AnimalRaceChoiceComponent implements OnInit {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService,
              private dialogRef: DynamicDialogRef, private dialogConfig: DynamicDialogConfig) { }

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
    this.http.post<string>(this.apiConfig.buildUrl('/fight/animals/my'),
      new HttpParams().append('racename', raceName), {headers:
        new HttpHeaders(
          {
            'Content-Type': 'application/x-www-form-urlencoded'
          }), withCredentials: true}).subscribe(() => {
            const onSelected = this.dialogConfig.data?.onSelected as ((selectedRace: string) => void) | undefined;
            onSelected?.(raceName);
            this.dialogRef.close(raceName);
          });
  }

}
