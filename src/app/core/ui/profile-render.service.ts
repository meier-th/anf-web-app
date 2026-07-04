import {Injectable} from '@angular/core';
import {User} from '../../classes/user';

@Injectable({
  providedIn: 'root'
})
export class ProfileRenderService {
  renderProfileAppearance(user: User): void {
    this.paintClass('hair', this.hairColor(user));
    this.paintClass('skin', this.skinColor(user));
    this.paintClass('clothes', this.clothesColor(user));
    this.toggleGender(user);
  }

  setHoveredGround(previous: HTMLElement | null, next: HTMLElement | null): HTMLElement | null {
    if (previous === next) {
      return previous;
    }
    if (previous) {
      previous.classList.remove('hovered-ground');
    }
    if (next) {
      next.classList.add('hovered-ground');
    }
    return next;
  }

  private paintClass(className: string, color: string): void {
    const elements = document.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
      (elements[i] as HTMLElement).style.fill = color;
      (elements[i] as HTMLElement).style.stroke = color;
    }
  }

  private toggleGender(user: User): void {
    const powers = document.getElementsByClassName('powers')[0] as HTMLElement | undefined;
    if (powers) {
      powers.style.display = 'none';
    }
    const males = document.getElementsByClassName('male');
    const females = document.getElementsByClassName('female');
    if (user.character.appearance.gender === 'FEMALE') {
      (females[0] as HTMLElement).style.display = 'block';
      (males[0] as HTMLElement).style.display = 'none';
    } else {
      (males[0] as HTMLElement).style.display = 'block';
      (females[0] as HTMLElement).style.display = 'none';
    }
    user.character.appearance.gender = user.character.appearance.gender ? 'FEMALE' : 'MALE';
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
