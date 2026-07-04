import {Injectable} from '@angular/core';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';

@Injectable({
  providedIn: 'root'
})
export class FightRenderService {
  setPosition(element: HTMLElement, i: number, margin = 0): void {
    element.style.position = 'absolute';
    element.style.bottom = (margin + 40 * ((i + 1) % 2)) + 'px';
    element.style.left = (80 * Math.round(i / 2) + 40 * ((i + 1) % 2)) + 'px';
  }

  setHPPercent(stats: HTMLElement, hp?: number): void {
    if (!Number.isFinite(hp)) {
      return;
    }
    const hpEl = stats.getElementsByClassName('hp')[0] as HTMLElement | undefined;
    if (!hpEl) {
      return;
    }
    hpEl.style.width = hp + '%';
  }

  setChakraPercent(stats: HTMLElement, mp?: number): void {
    if (!Number.isFinite(mp)) {
      return;
    }
    const mpEl = stats.getElementsByClassName('mp')[0] as HTMLElement | undefined;
    if (!mpEl) {
      return;
    }
    mpEl.style.width = mp + '%';
  }

  setAppearance(element: HTMLElement, user: User): void {
    this.paintClass(element, 'hair', this.hairColor(user));
    this.paintClass(element, 'skin', this.skinColor(user));
    this.paintClass(element, 'clothes', this.clothesColor(user));
  }

  animateUserDeath(user: User, fightersElements: { [key: string]: HTMLElement }): void {
    let counter = 0;
    let translate: string;
    const target = fightersElements[user.login];
    if (!target) {
      return;
    }
    const anim = setInterval(() => {
      counter++;
      target.style.transform = 'rotate(-' + counter + 'deg)';
      if (counter < 27) {
        translate = 'translate(0,-' + (counter) * 2 + 'px)';
        target.style.transform += translate;
      } else {
        target.style.transform += translate;
      }
      if (counter === 87) {
        clearInterval(anim);
      }
    }, 3);
  }

  animateAnimalDeath(animal: NinjaAnimal, allyAnimal: boolean, animalsElements: { [key: string]: HTMLElement }): void {
    let counter = 0;
    let translate: string;
    const key = `${allyAnimal ? 'ally' : 'enemy'}:${animal.name ?? ''}`;
    const target = animalsElements[key];
    if (!target) {
      return;
    }
    const anim = setInterval(() => {
      counter++;
      target.style.transform = 'rotate(-' + counter + 'deg)';
      if (counter < 27) {
        translate = 'translate(0,-' + (counter) * 2 + 'px)';
        target.style.transform += translate;
      } else {
        target.style.transform += translate;
      }
      if (counter === 87) {
        clearInterval(anim);
      }
    }, 3);
  }

  private paintClass(element: HTMLElement, className: string, color: string): void {
    const items = element.getElementsByClassName(className);
    for (let i = 0; i < items.length; i++) {
      (items[i] as HTMLElement).style.fill = color;
      (items[i] as HTMLElement).style.stroke = color;
    }
  }

  private hairColor(user: User): string {
    switch (user.character.appearance.hairColour) {
      case 'YELLOW':
        return '#DEAB7F';
      case 'BROWN':
        return '#A53900';
      case 'BLACK':
        return '#2D221C';
      default:
        return '#DEAB7F';
    }
  }

  private skinColor(user: User): string {
    switch (user.character.appearance.skinColour) {
      case 'BLACK':
        return '#6E2B12';
      case 'WHITE':
        return '#EBCCAB';
      case 'LATIN':
        return '#C37C4D';
      case 'DARK':
        return '#934C1D';
      default:
        return '#EBCCAB';
    }
  }

  private clothesColor(user: User): string {
    switch (user.character.appearance.clothesColour) {
      case 'RED':
        return 'crimson';
      case 'GREEN':
        return '#81E890';
      case 'BLUE':
        return 'cornflowerblue';
      default:
        return '#81E890';
    }
  }
}
