import {Injectable} from '@angular/core';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {FIGHT_UI} from '../constants/app.constants';

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

  playProjectile(fromEl: HTMLElement, toEl: HTMLElement, attackName?: string): void {
    const start = fromEl.getBoundingClientRect();
    const end = toEl.getBoundingClientRect();
    const startX = start.left + start.width / 2;
    const startY = start.top + start.height / 2;
    const endX = end.left + end.width / 2;
    const endY = end.top + end.height / 2;
    const projectile = document.createElement('div');
    projectile.className = 'projectile-rock';
    const projectileStyle = this.projectileStyleForAttack(attackName);
    projectile.style.position = 'fixed';
    projectile.style.width = `${FIGHT_UI.projectileSizePx}px`;
    projectile.style.height = `${FIGHT_UI.projectileSizePx}px`;
    projectile.style.borderRadius = '50%';
    projectile.style.background = projectileStyle.background;
    projectile.style.border = '1px solid rgba(20, 20, 20, 0.8)';
    projectile.style.boxShadow = projectileStyle.boxShadow;
    projectile.style.transform = 'translate(-50%, -50%)';
    projectile.style.transition = `transform ${FIGHT_UI.projectileDurationMs}ms linear`;
    projectile.style.zIndex = '1200';
    projectile.style.pointerEvents = 'none';
    projectile.style.left = `${startX}px`;
    projectile.style.top = `${startY}px`;
    document.body.appendChild(projectile);
    requestAnimationFrame(() => {
      projectile.style.transform = `translate(-50%, -50%) translate(${endX - startX}px, ${endY - startY}px)`;
    });
    let settled = false;
    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      projectile.remove();
      this.flashImpact(toEl);
    };
    projectile.addEventListener('transitionend', cleanup, {once: true});
    setTimeout(cleanup, FIGHT_UI.projectileCleanupMs);
  }

  flashImpact(targetEl: HTMLElement): void {
    const previousFilter = targetEl.style.filter;
    const previousTransition = targetEl.style.transition;
    targetEl.style.transition = 'filter 0.08s linear';
    targetEl.style.filter = 'brightness(1.6) saturate(1.8) drop-shadow(0 0 12px rgba(255, 40, 40, 0.95))';
    setTimeout(() => {
      targetEl.style.filter = previousFilter;
      targetEl.style.transition = previousTransition;
    }, FIGHT_UI.impactFlashMs);
  }

  setTargetable(elements: HTMLElement[], targetable: boolean): void {
    elements.forEach((targetElement) => {
      targetElement.style.cursor = targetable ? 'crosshair' : 'default';
      if (targetable) {
        targetElement.classList.add('target-glow');
        targetElement.style.filter = 'drop-shadow(0 0 10px rgba(255, 222, 89, 0.95))';
      } else {
        targetElement.classList.remove('target-glow');
        targetElement.style.filter = '';
      }
    });
  }

  private projectileStyleForAttack(attackName?: string): { background: string; boxShadow: string } {
    const normalized = (attackName ?? '').trim().toLowerCase();
    if (normalized.includes('fire')) {
      return {
        background: 'radial-gradient(circle at 30% 30%, #ffe08a 0%, #ff7b2f 48%, #c71919 100%)',
        boxShadow: '0 0 11px rgba(255, 96, 32, 0.85)'
      };
    }
    if (normalized.includes('water')) {
      return {
        background: 'radial-gradient(circle at 30% 30%, #d8f6ff 0%, #56b9ff 46%, #1559b5 100%)',
        boxShadow: '0 0 10px rgba(56, 162, 255, 0.75)'
      };
    }
    if (normalized.includes('air')) {
      return {
        background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #d6f0ff 52%, #9dc3db 100%)',
        boxShadow: '0 0 11px rgba(214, 240, 255, 0.8)'
      };
    }
    if (normalized.includes('earth')) {
      return {
        background: 'radial-gradient(circle at 30% 30%, #cfab7f 0%, #8a6d4f 45%, #533d2b 100%)',
        boxShadow: '0 0 8px rgba(188, 132, 78, 0.45)'
      };
    }
    if (normalized.includes('boss')) {
      return {
        background: 'radial-gradient(circle at 30% 30%, #f1dcff 0%, #9f6bff 50%, #4b1f8f 100%)',
        boxShadow: '0 0 12px rgba(146, 88, 255, 0.85)'
      };
    }
    return {
      background: 'radial-gradient(circle at 30% 30%, #d7d7d7 0%, #7d7d7d 45%, #3e3e3e 100%)',
      boxShadow: '0 0 6px rgba(255, 255, 255, 0.35)'
    };
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
