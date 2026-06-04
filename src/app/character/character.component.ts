import {AfterViewInit, Component, ComponentRef, ElementRef, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {User} from '../classes/user';

@Component({
  selector: 'app-character',
  standalone: false,
  templateUrl: './character.component.html',
  styleUrls: ['./character.component.less']
})
export class CharacterComponent implements OnInit, AfterViewInit {

  @ViewChild('stats') stats: ElementRef;
  @ViewChild('male') male: ElementRef;
  @ViewChild('female') female: ElementRef;
  @ViewChild('boss') boss: ElementRef;
  @ViewChild('animal') animal: ElementRef;
  private _bossId = 0;
  private _animalName = '';
  private viewReady = false;

  get animalName(): string {
    return this._animalName;
  }

  set animalName(value: string) {
    this._animalName = value + '.png';
    if (value === 'Uncle Baphomet') {
      this._animalName = 'uncle-baphomet.png';
    } else if (value === 'Auntie Ass') {
      this._animalName = 'aunt-ass.png';
    }
    this.applyVariantVisibility();
  }

  get bossId(): number {
    return this._bossId;
  }

  set bossId(value: number) {
    this._bossId = value;
    this.applyVariantVisibility();
  }

  constructor() {
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.applyVariantVisibility();
  }

  private applyVariantVisibility() {
    if (!this.viewReady || !this.male || !this.female || !this.boss || !this.animal) {
      return;
    }

    const male = this.male.nativeElement as HTMLElement;
    const female = this.female.nativeElement as HTMLElement;
    const boss = this.boss.nativeElement as HTMLImageElement;
    const animal = this.animal.nativeElement as HTMLImageElement;

    male.style.display = 'block';
    female.style.display = 'none';
    boss.style.display = 'none';
    animal.style.display = 'none';

    if (this._animalName.trim() !== '') {
      male.style.display = 'none';
      female.style.display = 'none';
      animal.style.display = 'block';
      animal.style.height = '200px';
      animal.style.width = 'auto';
      return;
    }

    if (this._bossId > 0) {
      male.style.display = 'none';
      female.style.display = 'none';
      boss.style.display = 'block';
      boss.style.height = '20%';
      boss.style.width = 'auto';
    }
  }

}
