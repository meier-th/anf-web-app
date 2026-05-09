import { Component, OnInit} from '@angular/core';
import { FightEndService} from '../services/fight-end.service';

@Component({
  selector: 'app-fight-result',
  standalone: false,
  templateUrl: './fight-result.component.html',
  styleUrls: ['./fight-result.component.less']
})
export class FightResultComponent implements OnInit {

  victory: boolean;
  loss: boolean;
  death: boolean;

  constructor(private serv: FightEndService) { }

  ngOnInit() {
    this.victory = this.serv.victory;
    this.loss = this.serv.loss;
    this.death = this.serv.death;
  }

}
