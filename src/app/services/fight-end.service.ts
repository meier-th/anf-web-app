import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FightEndService {

  victory = false;
  death = false;
  loss = false;
  ratingChange = 0;
  surrendered = false;

  constructor() { }
}
