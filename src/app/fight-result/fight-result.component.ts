import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { FightEndService} from '../services/fight-end.service';

@Component({
  selector: 'app-fight-result',
  standalone: false,
  templateUrl: './fight-result.component.html',
  styleUrls: ['./fight-result.component.less']
})
export class FightResultComponent implements OnInit {

  victory = false;
  loss = false;
  death = false;
  ratingChange = 0;
  surrendered = false;
  @Output() confirm = new EventEmitter<void>();

  constructor(private serv: FightEndService) { }

  ngOnInit() {
    this.victory = this.serv.victory;
    this.loss = this.serv.loss;
    this.death = this.serv.death;
    this.ratingChange = this.serv.ratingChange ?? 0;
    this.surrendered = this.serv.surrendered ?? false;
  }

  onConfirm() {
    this.confirm.emit();
  }

}
