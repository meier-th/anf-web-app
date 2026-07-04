import { Component, OnInit } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-info-page',
    templateUrl: './info-page.component.html',
    styleUrls: ['./info-page.component.less'],
    imports: [TranslatePipe]
})
export class InfoPageComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
