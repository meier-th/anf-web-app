import {Injectable, ViewContainerRef} from '@angular/core';
import {Router} from '@angular/router';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {FightService} from '../../services/fight/fight.service';
import {TranslatePipe} from '../../services/translate.pipe';
import {FIGHT_CONSTANTS, FIGHT_MESSAGES, APP_TIMINGS} from '../constants/app.constants';
import {Combatant, FightRoster, FightStateEvent, ResolvedAttack, SummonEvent} from '../domain/fight-combat.types';
import {FightCombatResolver} from '../domain/fight-combat-resolver.service';
import {FightDomainService} from '../domain/fight-domain.service';
import {FightRealtimeService} from '../realtime/fight-realtime.service';
import {AttackAnnouncement, FightAnnouncementsService} from '../state/fight-announcements.service';
import {SessionStore} from '../state/session.store';
import {FightStateStore} from '../state/fight-state.store';
import {FightSceneService} from '../ui/fight-scene.service';
import {FightOutcomeService} from './fight-outcome.service';
import {FightSessionService} from './fight-session.service';

const SUMMON_PREVIEW_BY_RACE: { [race: string]: { tier1: string; tier2: string } } = {
  veseliba: {tier1: 'vertet', tier2: 'ubele'},
  bojajumus: {tier1: 'lauva', tier2: 'lusis'},
  lidzsvaru: {tier1: 'erglis', tier2: 'lapsa'},
  bugurt: {tier1: 'aunt-ass', tier2: 'uncle-baphomet'}
};

/**
 * Orchestrator for the fight screen: wires realtime events through the
 * combat resolver into state/scene/announcements/outcome, and exposes the
 * small read-model + action surface FightComponent's template needs.
 *
 * Holds no business logic itself - each concern lives in its own service;
 * this only routes between them.
 */
@Injectable()
export class FightFacadeService {
  constructor(
    private router: Router,
    private transl: TranslatePipe,
    private fightService: FightService,
    private sessionStore: SessionStore,
    private fightDomain: FightDomainService,
    private resolver: FightCombatResolver,
    private realtime: FightRealtimeService,
    private stateStore: FightStateStore,
    private scene: FightSceneService,
    private session: FightSessionService,
    private outcome: FightOutcomeService,
    private announcementsService: FightAnnouncementsService
  ) {
  }

  get current(): string {
    return this.stateStore.current();
  }

  get currentUsername(): string {
    return this.sessionStore.username();
  }

  get skills(): string[] {
    return this.stateStore.skills();
  }

  get map(): { [key: string]: string } {
    return this.stateStore.map();
  }

  get selectedSpell(): string {
    return this.stateStore.selectedSpell();
  }

  get summonEnabled(): boolean {
    return this.stateStore.summonEnabled();
  }

  get attackEvents(): string[] {
    return this.stateStore.attackEvents();
  }

  get showDebugPanel(): boolean {
    return this.stateStore.showDebugPanel();
  }

  get debugLines(): string[] {
    return this.stateStore.debugLines();
  }

  get showFightResult(): boolean {
    return this.outcome.showResult();
  }

  get announcements(): AttackAnnouncement[] {
    return this.announcementsService.announcements();
  }

  get turnLabel(): string {
    return this.session.turnLabel();
  }

  get remainingSeconds(): number {
    return this.session.remainingSeconds();
  }

  get summonButtonSrc(): string {
    if (this.stateStore.useSummonIconFallback()) {
      return '../../assets/summon.png';
    }
    const previewAnimalName = this.stateStore.summonPreviewName();
    if (previewAnimalName) {
      return `../../assets/${previewAnimalName}.png`;
    }
    const race = (this.stateStore.resolveLocalSummoner()?.character?.animalRace ?? '').trim().toLowerCase();
    const animalByRace = SUMMON_PREVIEW_BY_RACE[race];
    if (!animalByRace) {
      return '../../assets/summon.png';
    }
    const level = this.stateStore.resolveLocalSummonerLevel();
    const animalImage = level >= FIGHT_CONSTANTS.summonLevelTwoThreshold ? animalByRace.tier2 : animalByRace.tier1;
    return `../../assets/${animalImage}.png`;
  }

  initFromRoute(): void {
    let type: string;
    let id: string;
    if (!this.fightService.valuesSet) {
      const segments = this.router.url.split('/').filter((segment) => segment.length > 0);
      type = segments[1] ?? '';
      id = segments[2] ?? '';
    } else {
      id = this.fightService.id;
      type = this.fightService.type;
    }
    this.stateStore.initSession(type, id);
    this.outcome.prepareForNewFight(type);
    this.scene.setAttackHandler((token) => this.session.attack(token));
    this.realtime.connect({
      onFightState: (event) => this.handleFightState(event),
      onTurnSwitch: (nextAttacker) => this.handleTurnSwitch(nextAttacker),
      onSummon: (event) => this.handleSummon(event)
    });
    this.session.loadFightInfo(type, id, (roster) => {
      this.scene.renderInitialScene(roster);
      this.refreshTargetHighlighting();
    });
  }

  dispose(): void {
    this.realtime.disconnect();
    this.session.stopTurnTimer();
    this.announcementsService.clear();
  }

  setContainers(alliesContainer?: ViewContainerRef, enemiesContainer?: ViewContainerRef): void {
    this.scene.attachContainers(alliesContainer, enemiesContainer);
  }

  isSkillDisabled(skill: string): boolean {
    return this.stateStore.isSkillDisabled(skill);
  }

  selectSpell(event: MouseEvent): void {
    if (this.stateStore.current() !== this.sessionStore.username()) {
      alert(this.transl.transform(FIGHT_MESSAGES.notYourTurn));
      return;
    }
    const selectedSpell = (event.target as HTMLElement | null)?.id ?? FIGHT_CONSTANTS.defaultSkill;
    if (this.stateStore.isSkillDisabled(selectedSpell)) {
      alert(this.transl.transform(FIGHT_MESSAGES.notEnoughChakra));
      this.stateStore.selectSpell(FIGHT_CONSTANTS.defaultSkill);
    } else {
      this.stateStore.selectSpell(selectedSpell);
    }
    this.refreshTargetHighlighting();
  }

  attack(targetToken: string): void {
    this.session.attack(targetToken);
  }

  summon(): void {
    this.session.summon();
  }

  onSummonButtonImageError(): void {
    this.stateStore.setUseSummonIconFallback(true);
  }

  onFightResultOk(): void {
    this.outcome.acknowledgeResult();
  }

  private handleFightState(event: FightStateEvent): void {
    const roster = this.stateStore.snapshotRoster();
    const resolved = this.resolver.resolve(roster, event);

    this.stateStore.logDebug(`WS ${roster.type.toUpperCase()} ${event.attacker} -> ${event.target} (${event.attackName}) dmg=${event.damage}`);
    this.announcementsService.schedule(
      `${event.attacker} ${this.transl.transform('attacked')} ${event.target} ${this.transl.transform('for')} ${event.damage} (${event.attackName})`,
      resolved.attacker.kind === 'animal');
    this.stateStore.logAttackEvent(`${event.attacker} -> ${event.target}: ${event.damage} (${event.attackName})`);
    this.session.startTurnTimer(event.nextAttacker, APP_TIMINGS.fightTurnWindowMs);
    this.refreshTargetHighlighting();

    if (resolved.isSurrender) {
      this.outcome.handleSurrenderState(event.attacker);
      return;
    }

    this.scene.playAttackVisual(event.attacker, event.target, event.attackName);
    this.applyResolvedAttack(resolved, event, roster);
    this.session.refreshFromServer();
  }

  private handleTurnSwitch(nextAttacker: string): void {
    this.stateStore.logDebug(`WS switch next=${nextAttacker}`);
    this.session.startTurnTimer(nextAttacker, APP_TIMINGS.fightTurnTickMs);
    this.refreshTargetHighlighting();
    this.session.refreshFromServer();
  }

  private handleSummon(event: SummonEvent): void {
    const animal = new NinjaAnimal();
    animal.currentChakra = 100;
    animal.damage = event.damage;
    animal.maxHP = event.maxHp;
    animal.name = event.name;
    animal.race = event.race;
    animal.currentHP = animal.maxHP;
    const isAlly = this.stateStore.allies().some((ally) => ally.login === event.summoner);
    if (this.stateStore.addSummonedAnimal(animal, isAlly)) {
      this.scene.drawAnimal(animal, isAlly);
    }
    this.session.refreshFromServer();
  }

  private applyResolvedAttack(resolved: ResolvedAttack, event: FightStateEvent, roster: FightRoster): void {
    const isPvp = roster.type === 'pvp';
    this.applyTargetDamage(resolved.target, event, isPvp, roster);
    this.applyAttackerChakra(resolved.attacker, event, isPvp);
    if (!event.deadly) {
      return;
    }
    this.applyDeath(resolved.target);
    if (resolved.isFightOver) {
      this.applyFightOverOutcome(resolved, roster);
    }
  }

  private applyTargetDamage(target: Combatant, event: FightStateEvent, isPvp: boolean, roster: FightRoster): void {
    if (target.kind === 'user') {
      target.ref.character.currentHP = Math.max(0, target.ref.character.currentHP - event.damage);
      if (isPvp) {
        target.ref.character.currentChakra -= event.chakraBurn;
        this.scene.updateFighterBars(target.ref.login, this.stateStore.userHpPercent(target.ref), this.stateStore.userChakraPercent(target.ref));
      } else {
        // PVE intentionally doesn't mirror chakra burn client-side (existing behavior; refreshFromServer() true's it up).
        this.scene.updateFighterBars(target.ref.login, this.stateStore.userHpPercent(target.ref), undefined);
      }
    } else if (target.kind === 'animal') {
      const result = this.fightDomain.applyDamageToAnimal(target.ref, event.damage);
      if (result.hpPercent === undefined) {
        this.stateStore.logDebug(`Animal damage skipped (missing values) animal=${target.ref?.name ?? 'unknown'} dmg=${event.damage}`);
      } else {
        this.stateStore.logDebug(
          `Animal damage ${target.ref?.name ?? 'unknown'}: ${result.current}/${result.max} -> ${result.next}/${result.max} (${Math.round(result.hpPercent)}%)`);
      }
      this.scene.updateAnimalBar(target.ref.name, result.hpPercent, roster.mySide.animals.includes(target.ref));
    } else if (target.kind === 'boss') {
      this.scene.updateBossBar(this.stateStore.applyBossDamage(event.damage));
    }
    this.stateStore.ensureSelectedSpellIsAvailable();
  }

  private applyAttackerChakra(attacker: Combatant, event: FightStateEvent, isPvp: boolean): void {
    if (attacker.kind !== 'user') {
      return;
    }
    if (isPvp) {
      attacker.ref.character.currentChakra -= event.chakraCost;
    }
    this.scene.updateFighterBars(attacker.ref.login, undefined, this.stateStore.userChakraPercent(attacker.ref));
  }

  private applyDeath(target: Combatant): void {
    if (target.kind === 'user') {
      this.stateStore.recordCombatantDeath(target);
      this.scene.markFighterDead(target.ref);
    } else if (target.kind === 'animal') {
      this.scene.markAnimalDead(target.ref);
    }
  }

  private applyFightOverOutcome(resolved: ResolvedAttack, roster: FightRoster): void {
    if (roster.type === 'pvp') {
      this.outcome.finishFight({death: false, victory: resolved.yourSideAttacks, loss: !resolved.yourSideAttacks});
      return;
    }
    if (!resolved.yourSideAttacks) {
      this.outcome.finishFight({death: this.stateStore.hasLocalPlayerDied(), victory: false, loss: true});
      return;
    }
    if (this.stateStore.hasLocalPlayerDied()) {
      this.outcome.finishFight({death: true, victory: false, loss: false});
    } else {
      this.outcome.finishFight({death: false, victory: true, loss: false});
    }
  }

  private refreshTargetHighlighting(): void {
    const targetable = this.stateStore.current() === this.sessionStore.username()
      && !this.stateStore.fightEnded()
      && !this.outcome.showResult();
    this.scene.refreshTargetHighlighting(targetable);
  }
}
