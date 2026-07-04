import {ComponentFactoryResolver, ComponentRef, Injectable, ViewContainerRef} from '@angular/core';
import {CharacterComponent} from '../../character/character.component';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {FightRoster} from '../domain/fight-combat.types';
import {FightDomainService} from '../domain/fight-domain.service';
import {FightStateStore} from '../state/fight-state.store';
import {FightRenderService} from './fight-render.service';

/**
 * The DOM "scene" for a fight: creates character components for
 * allies/enemies/boss/animals, tracks the element registries that
 * correlate roster entries to their DOM nodes, and is the only place
 * that resolves "which element(s) does this login/token correspond to".
 *
 * Delegates actual style/animation mutation to FightRenderService; owns
 * the lookup/fallback heuristics needed to find the right element(s).
 */
@Injectable()
export class FightSceneService {
  private alliesContainer?: ViewContainerRef;
  private enemiesContainer?: ViewContainerRef;
  private sceneInitialized = false;
  private attackHandler: (targetToken: string) => void = () => {
  };

  private readonly fightersElements: { [login: string]: HTMLElement } = {};
  private readonly statsElements: { [key: string]: HTMLElement } = {};
  private readonly animalsElements: { [key: string]: HTMLElement } = {};
  private bossElement?: HTMLElement;
  private pendingAnimalsToDraw: Array<{ animal: NinjaAnimal; ally: boolean }> = [];

  constructor(
    private resolver: ComponentFactoryResolver,
    private fightDomain: FightDomainService,
    private fightRender: FightRenderService,
    private stateStore: FightStateStore
  ) {
  }

  setAttackHandler(handler: (targetToken: string) => void): void {
    this.attackHandler = handler;
  }

  attachContainers(alliesContainer?: ViewContainerRef, enemiesContainer?: ViewContainerRef): void {
    this.alliesContainer = alliesContainer;
    this.enemiesContainer = enemiesContainer;
    if (this.stateStore.loaded()) {
      this.renderInitialScene(this.stateStore.snapshotRoster());
      this.drawPendingAnimals();
    }
  }

  renderInitialScene(roster: FightRoster): void {
    if (!this.alliesContainer || !this.enemiesContainer || this.sceneInitialized) {
      return;
    }
    const allies = roster.mySide.users;
    const factory = this.resolver.resolveComponentFactory(CharacterComponent);
    let character: ComponentRef<CharacterComponent>;
    for (let i = 0; i < allies.length; i++) {
      character = this.alliesContainer.createComponent(factory);
      const fighter = allies[allies.length - i - 1];
      const genderId = fighter.character.appearance.gender === 'FEMALE' ? 1 : 0;
      const root = <HTMLElement>character.location.nativeElement;
      const element = <HTMLElement>root.querySelector(genderId === 1 ? '.female' : '.male');
      const hidden = <HTMLElement>root.querySelector(genderId === 1 ? '.male' : '.female');
      const stats = <HTMLElement>root.querySelector('.powers');
      if (!element || !hidden || !stats) {
        continue;
      }
      this.fightersElements[fighter.login] = element;
      element.style.display = 'block';
      this.fightRender.setPosition(element, i);
      hidden.style.display = 'none';
      stats.dataset.login = fighter.login;
      this.statsElements[fighter.login] = stats;
      this.fightRender.setPosition(stats, i, 125);
      (<HTMLElement>stats.getElementsByClassName('name')[0]).innerText = fighter.login;
      this.updateFighterBars(fighter.login, this.stateStore.userHpPercent(fighter), this.stateStore.userChakraPercent(fighter));
      this.fightRender.setAppearance(element, fighter);
    }

    if (roster.type === 'pvp') {
      const enemy = roster.otherSide.users[0];
      character = this.enemiesContainer.createComponent(factory);
      const genderId = enemy.character.appearance.gender === 'FEMALE' ? 1 : 0;
      const root = <HTMLElement>character.location.nativeElement;
      const element = <HTMLElement>root.querySelector(genderId === 1 ? '.female' : '.male');
      const hidden = <HTMLElement>root.querySelector(genderId === 1 ? '.male' : '.female');
      const stats = <HTMLElement>root.querySelector('.powers');
      if (!element || !hidden || !stats) {
        return;
      }
      this.fightersElements[enemy.login] = element;
      element.style.display = 'block';
      element.classList.add('enemy');
      hidden.style.display = 'none';
      this.fightRender.setAppearance(element, enemy);
      stats.dataset.login = enemy.login;
      this.statsElements[enemy.login] = stats;
      this.updateFighterBars(enemy.login, this.stateStore.userHpPercent(enemy), this.stateStore.userChakraPercent(enemy));
      (<HTMLElement>stats.getElementsByClassName('name')[0]).innerText = enemy.login;
      element.addEventListener('click', () => this.attackHandler(enemy.login));
      element.classList.add('enemy-target');
    } else {
      const boss = roster.boss;
      const bossComponent = this.enemiesContainer.createComponent(factory);
      bossComponent.instance.bossId = boss.numberOfTails;
      this.statsElements[boss.numberOfTails] = (<HTMLElement>(<HTMLElement>bossComponent
        .location.nativeElement).childNodes[0]);
      (<HTMLElement>bossComponent.location.nativeElement).style.position = 'absolute';
      (<HTMLElement>bossComponent.location.nativeElement).style.bottom = '-40px';
      (<HTMLElement>bossComponent.location.nativeElement).style.right = '20px';
      this.bossElement = <HTMLElement>bossComponent.location.nativeElement;
      this.bossElement.addEventListener('click', () => this.attackHandler(String(boss.numberOfTails)));
      this.bossElement.classList.add('enemy-target');
    }
    this.sceneInitialized = true;
  }

  drawAnimal(animal: NinjaAnimal, ally: boolean): void {
    if (!this.alliesContainer || !this.enemiesContainer) {
      this.enqueuePendingAnimal(animal, ally);
      return;
    }
    const factory = this.resolver.resolveComponentFactory(CharacterComponent);
    let element: ComponentRef<CharacterComponent>;
    if (ally) {
      element = this.alliesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      const stats = wrapper.querySelector('.powers') as HTMLElement | null;
      if (stats) {
        stats.dataset.animalKey = this.fightDomain.getAnimalStatsKey(animal.name);
        stats.dataset.animalSide = 'ally';
        this.statsElements[this.fightDomain.getAnimalSideKey(animal.name, true)] = stats;
      }
      const allyIndex = this.stateStore.animals1().findIndex((it) => it.name === animal.name);
      this.fightRender.setPosition(wrapper, this.stateStore.allies().length + Math.max(allyIndex, 0) + 1);
    } else {
      element = this.enemiesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      const stats = wrapper.querySelector('.powers') as HTMLElement | null;
      if (stats) {
        stats.dataset.animalKey = this.fightDomain.getAnimalStatsKey(animal.name);
        stats.dataset.animalSide = 'enemy';
        this.statsElements[this.fightDomain.getAnimalSideKey(animal.name, false)] = stats;
      }
      wrapper.style.position = 'absolute';
      wrapper.style.bottom = '40px';
      const enemyIndex = this.stateStore.animals2().findIndex((it) => it.name === animal.name);
      wrapper.style.right = (80 + Math.max(enemyIndex, 0) * 80) + 'px';
      wrapper.style.transform = 'scaleX(-1)';
      wrapper.classList.add('enemy-target');
      wrapper.addEventListener('click', () => {
        const token = this.buildAnimalTargetToken(animal.name, false);
        this.stateStore.logDebug(`Attack request enemy animal ${animal.name} token=${token}`);
        this.attackHandler(token);
      });
    }
    this.animalsElements[this.fightDomain.getAnimalElementSideKey(animal.name, ally)] = <HTMLElement>element.location.nativeElement;
  }

  drawPendingAnimals(): void {
    if (!this.alliesContainer || !this.enemiesContainer || this.pendingAnimalsToDraw.length === 0) {
      return;
    }
    const pending = [...this.pendingAnimalsToDraw];
    this.pendingAnimalsToDraw = [];
    pending.forEach(({animal, ally}) => this.drawAnimal(animal, ally));
  }

  updateFighterBars(login: string, hp?: number, chakra?: number): void {
    const allStats = Array.from(document.querySelectorAll('.powers')) as HTMLElement[];
    const matchedByLogin = allStats.filter((stats) => (stats.dataset?.login ?? '').trim() === (login ?? '').trim());
    const matchedByLabel = allStats.filter((stats) => {
      const nameEl = stats.getElementsByClassName('name')[0] as HTMLElement | undefined;
      return (nameEl?.innerText ?? '').trim() === (login ?? '').trim();
    });
    const candidates = Array.from(new Set<HTMLElement>([
      ...matchedByLogin,
      ...matchedByLabel,
      this.statsElements[login]
    ].filter(Boolean)));

    candidates.forEach((stats) => {
      if (hp !== undefined) {
        this.fightRender.setHPPercent(stats, hp);
      }
      if (chakra !== undefined) {
        this.fightRender.setChakraPercent(stats, chakra);
      }
    });
  }

  updateAnimalBar(tokenOrName: string, hp?: number, preferAlly?: boolean): void {
    if (hp === undefined) {
      const fallbackAnimal = this.resolveAnimalFromToken(tokenOrName, preferAlly);
      hp = this.animalHpPercentSafe(fallbackAnimal);
    }
    if (hp === undefined) {
      this.stateStore.logDebug(`Animal bar skipped hp undefined token=${tokenOrName}`);
      return;
    }
    const candidates: Array<HTMLElement | undefined> = [];
    if (preferAlly !== undefined) {
      candidates.push(this.statsElements[this.fightDomain.getAnimalSideKey(tokenOrName, preferAlly)]);
    } else {
      candidates.push(this.statsElements[this.fightDomain.getAnimalSideKey(tokenOrName, true)]);
      candidates.push(this.statsElements[this.fightDomain.getAnimalSideKey(tokenOrName, false)]);
    }
    const animalKey = this.fightDomain.getAnimalStatsKey(tokenOrName);
    const domCandidates = Array.from(document.querySelectorAll('.powers')) as HTMLElement[];
    const preferredSide = preferAlly === undefined ? undefined : (preferAlly ? 'ally' : 'enemy');
    const preferredMatches = domCandidates.filter((stats) =>
      (stats.dataset?.animalKey ?? '') === animalKey
      && (preferredSide ? (stats.dataset?.animalSide ?? '') === preferredSide : true));
    const anyMatches = domCandidates.filter((stats) => (stats.dataset?.animalKey ?? '') === animalKey);
    const fallbackStats = candidates.find((candidate) => !!candidate);
    const targets: HTMLElement[] = fallbackStats
      ? [fallbackStats]
      : (preferAlly !== undefined
          ? preferredMatches
          : (() => {
              const first = preferredMatches[0] ?? anyMatches[0];
              return first ? [first] : [];
            })());
    if (targets.length > 0) {
      targets.forEach((stats) => this.fightRender.setHPPercent(stats, hp));
      this.stateStore.logDebug(
        `Animal bar set token=${tokenOrName} side=${preferredSide ?? 'auto'} hp=${Math.round(hp)}% targets=${targets.length}`);
    } else {
      this.stateStore.logDebug(`Animal bar target NOT found token=${tokenOrName} side=${preferredSide ?? 'auto'} hp=${Math.round(hp)}%`);
    }
  }

  updateBossBar(hpPercent?: number): void {
    const boss = this.stateStore.boss();
    if (!boss || hpPercent === undefined || !this.statsElements[boss.numberOfTails]) {
      return;
    }
    this.fightRender.setHPPercent(this.statsElements[boss.numberOfTails], hpPercent);
  }

  markFighterDead(user: User): void {
    if (this.statsElements[user.login]) {
      this.statsElements[user.login].style.display = 'none';
    }
    this.fightRender.animateUserDeath(user, this.fightersElements);
  }

  markAnimalDead(animal: NinjaAnimal): void {
    const allyAnimal = this.stateStore.animals1().includes(animal);
    const key = this.fightDomain.getAnimalSideKey(animal?.name, allyAnimal);
    if (this.statsElements[key]) {
      this.statsElements[key].style.display = 'none';
    }
    this.fightRender.animateAnimalDeath(animal, allyAnimal, this.animalsElements);
  }

  playAttackVisual(attackerToken: string, targetToken: string, attackName?: string): void {
    if (this.stateStore.fightEnded() || !attackerToken || !targetToken) {
      return;
    }
    const attackerEl = this.resolveCombatantElement(attackerToken);
    const attackerIsAlly = this.isAllyCombatant(attackerToken);
    const targetEl = this.resolveCombatantElement(targetToken, attackerIsAlly === undefined ? undefined : !attackerIsAlly);
    if (!attackerEl || !targetEl) {
      this.stateStore.logDebug(`Projectile skipped attacker=${attackerToken}(${!!attackerEl}) target=${targetToken}(${!!targetEl})`);
      return;
    }
    this.stateStore.logDebug(`Projectile ${attackName ?? 'Physical'} ${attackerToken} -> ${targetToken}`);
    this.fightRender.playProjectile(attackerEl, targetEl, attackName);
  }

  refreshTargetHighlighting(targetable: boolean): void {
    const targets = Array.from(document.querySelectorAll('.enemy-target')) as HTMLElement[];
    this.fightRender.setTargetable(targets, targetable);
    this.stateStore.logDebug(`Target highlight active=${targetable} count=${targets.length}`);
  }

  buildAnimalTargetToken(tokenOrName: string, ally: boolean): string {
    return this.fightDomain.buildAnimalTargetToken(
      tokenOrName, ally, this.stateStore.type() === 'pvp', this.stateStore.pvpCurrentUserIsBackendSecond());
  }

  private animalHpPercentSafe(animal?: NinjaAnimal): number | undefined {
    return animal ? this.fightDomain.animalHpPercent(animal) : undefined;
  }

  private resolveAnimalFromToken(tokenOrName: string, preferAlly?: boolean): NinjaAnimal | undefined {
    if (preferAlly === true) {
      return this.fightDomain.findAnimalByToken(this.stateStore.animals1(), tokenOrName);
    }
    if (preferAlly === false) {
      return this.fightDomain.findAnimalByToken(this.stateStore.animals2(), tokenOrName);
    }
    return this.fightDomain.findAnimalByToken(this.stateStore.animals1(), tokenOrName)
      ?? this.fightDomain.findAnimalByToken(this.stateStore.animals2(), tokenOrName);
  }

  private resolveCombatantElement(id: string, preferAllyForAnimal?: boolean): HTMLElement | undefined {
    if (!id) {
      return undefined;
    }
    if (this.fightersElements[id]) {
      return this.fightersElements[id];
    }
    const tokenSide = this.fightDomain.sideFromAnimalToken(id);
    const animals1 = this.stateStore.animals1();
    const animals2 = this.stateStore.animals2();
    if (tokenSide === 'ally') {
      const allyAnimal = this.fightDomain.findAnimalByToken(animals1, id);
      if (allyAnimal) {
        return this.animalsElements[this.fightDomain.getAnimalElementSideKey(allyAnimal.name, true)];
      }
    } else if (tokenSide === 'enemy') {
      const enemyAnimal = this.fightDomain.findAnimalByToken(animals2, id);
      if (enemyAnimal) {
        return this.animalsElements[this.fightDomain.getAnimalElementSideKey(enemyAnimal.name, false)];
      }
    } else {
      const tryOrder = preferAllyForAnimal === false
        ? [[animals2, false], [animals1, true]] as const
        : [[animals1, true], [animals2, false]] as const;
      for (const [list, ally] of tryOrder) {
        const animal = this.fightDomain.findAnimalByToken(list as NinjaAnimal[], id);
        if (animal) {
          return this.animalsElements[this.fightDomain.getAnimalElementSideKey(animal.name, ally as boolean)];
        }
      }
    }
    if (/^\d+$/.test(id) && this.bossElement) {
      return this.bossElement;
    }
    return undefined;
  }

  private isAllyCombatant(id: string): boolean | undefined {
    if (!id) {
      return undefined;
    }
    if (this.stateStore.allies().some((ally) => ally.login === id)) {
      return true;
    }
    if (this.stateStore.enemies().some((enemy) => enemy.login === id)) {
      return false;
    }
    const tokenSide = this.fightDomain.sideFromAnimalToken(id);
    if (tokenSide === 'ally') {
      return true;
    }
    if (tokenSide === 'enemy') {
      return false;
    }
    if (this.fightDomain.findAnimalByToken(this.stateStore.animals1(), id)) {
      return true;
    }
    if (this.fightDomain.findAnimalByToken(this.stateStore.animals2(), id)) {
      return false;
    }
    return undefined;
  }

  private enqueuePendingAnimal(animal: NinjaAnimal, ally: boolean): void {
    const exists = this.pendingAnimalsToDraw.some(
      (it) => it.ally === ally && (it.animal?.name ?? '') === (animal?.name ?? ''));
    if (!exists) {
      this.pendingAnimalsToDraw.push({animal, ally});
    }
  }
}
