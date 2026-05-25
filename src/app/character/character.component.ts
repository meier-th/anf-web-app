import {Component, ComponentRef, ElementRef, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {User} from '../classes/user';

@Component({
  selector: 'app-character',
  standalone: false,
  templateUrl: './character.component.html',
  styleUrls: ['./character.component.less']
})
export class CharacterComponent implements OnInit {

  @ViewChild('stats') stats: ElementRef;
  @ViewChild('male') male: ElementRef;
  @ViewChild('female') female: ElementRef;
  @ViewChild('boss') boss: ElementRef;
  @ViewChild('animal') animal: ElementRef;
  private _bossId = 1;
  private _animalName = ' ';

  get animalName(): string {
    return this._animalName;
  }

  set animalName(value: string) {
    this._animalName = value + '.png';
    if (value === 'Дядя Бафомет') {
      this._animalName = 'bath.png';
    } else if (value === 'Тётя Срака') {
      this._animalName = 'tot.svg';
    }
    (<HTMLElement>this.male.nativeElement).style.display = 'none';
    (<HTMLElement>this.female.nativeElement).style.display = 'none';
    (<HTMLImageElement>this.animal.nativeElement).style.display = 'block';
    (<HTMLImageElement>this.animal.nativeElement).style.height = '200px';
    (<HTMLImageElement>this.animal.nativeElement).style.width = 'auto';
  }

  get bossId(): number {
    return this._bossId;
  }

  set bossId(value: number) {
    this._bossId = value;
    (<HTMLElement>this.male.nativeElement).style.display = 'none';
    (<HTMLElement>this.female.nativeElement).style.display = 'none';
    (<HTMLImageElement>this.boss.nativeElement).style.display = 'block';
    (<HTMLImageElement>this.boss.nativeElement).style.height = '20%';
    (<HTMLImageElement>this.boss.nativeElement).style.width = 'auto';
  }

  constructor() {
  }

  ngOnInit() {
  }

}
