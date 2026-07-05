import {Injectable, computed, signal} from '@angular/core';
import {Boss} from '../../classes/boss';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {TranslatePipe} from '../../services/translate.pipe';
import {FightApiService} from '../api/fight-api.service';
import {FIGHT_CONSTANTS, FIGHT_UI} from '../constants/app.constants';
import {FightRoster} from '../domain/fight-combat.types';
import {FightDomainService} from '../domain/fight-domain.service';
import {SessionStore} from '../state/session.store';
import {FightStateStore} from '../state/fight-state.store';
import {FightSceneService} from '../ui/fight-scene.service';

/**
 * API-facing use-case coordinator: loads fight data, performs attack/summon
 * actions, keeps roster HP/chakra fresh from the server, and runs the turn
 * timer. Writes into FightStateStore, tells FightSceneService to repaint
 * bars it changed.
 */
@Injectable()
export class FightSessionService {
  private readonly _remainingMs = signal(0);
  private readonly _turnLabel = signal('');
  readonly remainingSeconds = computed(() => Math.max(0, Math.ceil(this._remainingMs() / FIGHT_UI.timerStepMs)));
  readonly turnLabel = computed(() => this._turnLabel());

  private timer?: ReturnType<typeof setInterval>;
  private timeoutReported = false;

  constructor(
    private fightApi: FightApiService,
    private fightDomain: FightDomainService,
    private stateStore: FightStateStore,
    private scene: FightSceneService,
    private sessionStore: SessionStore,
    private transl: TranslatePipe
  ) {
  }

  loadFightInfo(type: string, id: string, onReady: (roster: FightRoster) => void): void {
    if (type.toLowerCase() === 'pvp') {
      this.loadPvpFightInfo(id, onReady);
    } else {
      this.loadPveFightInfo(id, onReady);
    }
  }

  attack(targetToken: string): void {
    if (this.stateStore.current() !== this.sessionStore.username()) {
      return;
    }
    if (this.stateStore.isSkillDisabled(this.stateStore.selectedSpell())) {
      this.stateStore.selectSpell(FIGHT_CONSTANTS.defaultSkill);
    }
    this.fightApi.attack(this.stateStore.fightId(), targetToken, this.stateStore.selectedSpell()).subscribe({
      next: () => this.refreshFromServer(),
      error: () => {
      }
    });
  }

  summon(): void {
    this.fightApi.summon(this.stateStore.type(), this.stateStore.fightId()).subscribe(() => {
      this.stateStore.setSummonEnabled(false);
    });
  }

  refreshFromServer(): void {
    if (this.stateStore.fightEnded()) {
      return;
    }
    this.fightApi.getInfo<any>(this.stateStore.fightId()).subscribe({
      next: (data) => this.applyServerSnapshot(data),
      error: (error) => {
        // Fight can be removed immediately after a decisive hit.
        if (error?.status === 404) {
          return;
        }
        console.error(error);
      },
      complete: () => this.stateStore.ensureSelectedSpellIsAvailable()
    });
  }

  startTurnTimer(currentName: string, timeLeftMs: number): void {
    clearInterval(this.timer);
    this.timeoutReported = false;
    this.stateStore.setCurrentTurn(currentName);
    this._turnLabel.set(this.computeTurnLabel(currentName));
    this._remainingMs.set(Math.max(0, timeLeftMs));
    this.timer = setInterval(() => {
      const next = Math.max(0, this._remainingMs() - FIGHT_UI.timerStepMs);
      this._remainingMs.set(next);
      if (next === 0 && this.stateStore.current() && !this.timeoutReported) {
        this.timeoutReported = true;
        this.reportTurnTimeout();
      }
    }, FIGHT_UI.timerStepMs);
  }

  stopTurnTimer(): void {
    clearInterval(this.timer);
  }

  private loadPvpFightInfo(id: string, onReady: (roster: FightRoster) => void): void {
    this.fightApi.getInfo<{
      id: number, type: string,
      fighters1: User, fighters2: User,
      animals1: NinjaAnimal[], animals2: NinjaAnimal[],
      currentName: string, timeLeft: number
    }>(id).subscribe((data) => {
      this.startTurnTimer(data.currentName, data.timeLeft);
      const pvpCurrentUserIsBackendSecond = data.fighters2.login === this.sessionStore.username();
      this.stateStore.setPvpCurrentUserIsBackendSecond(pvpCurrentUserIsBackendSecond);
      if (pvpCurrentUserIsBackendSecond) {
        const tmpFighter = data.fighters1;
        data.fighters1 = data.fighters2;
        data.fighters2 = tmpFighter;
        const tmpAnimals = data.animals1;
        data.animals1 = data.animals2;
        data.animals2 = tmpAnimals;
      }
      this.stateStore.setUseSummonIconFallback(false);
      this.stateStore.setSummonEnabled(this.stateStore.summonEnabled() && data.fighters1.character.animalRace != null);
      [data.fighters1, data.fighters2].forEach((fighter) => this.seedMaxStats(fighter));
      const animals1 = data.animals1 ?? [];
      const animals2 = data.animals2 ?? [];
      this.stateStore.setRoster([data.fighters1], [data.fighters2], animals1, animals2, undefined);

      const skills: string[] = [FIGHT_CONSTANTS.defaultSkill];
      const map: { [key: string]: string } = {};
      map[FIGHT_CONSTANTS.defaultSkill] = `${FIGHT_CONSTANTS.defaultSkill}\n` +
        this.transl.transform('Damage') + ': ' + data.fighters1.character.physicalDamage +
        '\n' + this.transl.transform('Chakra') + ': 0';
      (data.fighters1.character.spellsKnown ?? []).forEach((it) => {
        skills.push(it.spellUse.name);
        map[it.spellUse.name] = it.spellUse.name +
          '\n' + this.transl.transform('Damage') + ':' + (it.spellUse.baseDamage) +
          '\n' + this.transl.transform('Chakra') + ': ' + it.spellUse.baseChakraConsumption;
      });
      this.stateStore.setSkills(skills, map);
      this.stateStore.setLoaded(true);
      this.loadSummonPreviewIcon();
      const roster = this.stateStore.snapshotRoster();
      onReady(roster);
      animals1.forEach((animal) => this.scene.drawAnimal(animal, true));
      animals2.forEach((animal) => this.scene.drawAnimal(animal, false));
    });
    if (this.stateStore.animals1().length > 0) {
      this.stateStore.setSummonEnabled(false);
    }
  }

  private loadPveFightInfo(id: string, onReady: (roster: FightRoster) => void): void {
    this.fightApi.getInfo<{
      id: number, type: string, fighters1: User[], currentName: string, timeLeft: number,
      boss: Boss, animals1: NinjaAnimal[]
    }>(id).subscribe((data) => {
      this.startTurnTimer(data.currentName, data.timeLeft);
      this.stateStore.setUseSummonIconFallback(false);
      data.fighters1.forEach((fighter) => this.seedMaxStats(fighter));
      this.stateStore.setRoster(data.fighters1, [], data.animals1 ?? [], [], data.boss);

      const localFighter = data.fighters1.find((us) => us.login === this.sessionStore.username()) ?? data.fighters1[0];
      const skills: string[] = [FIGHT_CONSTANTS.defaultSkill];
      const map: { [key: string]: string } = {};
      map[FIGHT_CONSTANTS.defaultSkill] = `${FIGHT_CONSTANTS.defaultSkill}\n` +
        this.transl.transform('Damage') + ': ' +
        (localFighter?.character?.physicalDamage ?? 0) + '\n' + this.transl.transform('Chakra') + ': 0';
      (localFighter?.character?.spellsKnown ?? []).forEach((it) => {
        skills.push(it.spellUse.name);
        map[it.spellUse.name] = it.spellUse.name +
          '\n' + this.transl.transform('Damage') + ': ' +
          (it.spellUse.baseDamage) + '\n' + this.transl.transform('Chakra') +
          ': ' + it.spellUse.baseChakraConsumption;
      });
      this.stateStore.setSkills(skills, map);
      this.stateStore.setLoaded(true);
      this.loadSummonPreviewIcon();
      const roster = this.stateStore.snapshotRoster();
      onReady(roster);
      (data.animals1 ?? []).forEach((animal) => {
        this.scene.drawAnimal(animal, true);
        if (animal.summoner === this.sessionStore.username()) {
          this.stateStore.setSummonEnabled(false);
        }
      });
    });
  }

  private seedMaxStats(fighter: User): void {
    if (!fighter?.login) {
      return;
    }
    const maxHp = this.fightDomain.readNumber(fighter.character, 'maxHp', 'maxHP', 'hpAmount');
    const maxChakra = this.fightDomain.readNumber(fighter.character, 'maxChakra', 'maxchakra', 'chakraAmount');
    this.stateStore.seedFighterMaxStats(fighter.login, maxHp, maxChakra);
  }

  private applyServerSnapshot(data: any): void {
    if (this.stateStore.type() === 'pvp') {
      const side1 = data.fighters1;
      const side2 = data.fighters2;
      [side1, side2].forEach((participant) => {
        if (participant?.login) {
          this.stateStore.syncLocalFighterFromPayload(participant);
          this.scene.updateFighterBars(participant.login, this.stateStore.userHpPercent(participant), this.stateStore.userChakraPercent(participant));
        }
      });

      const localAllyLogin = this.stateStore.allies()[0]?.login;
      const side1IsAlly = !!localAllyLogin && side1?.login === localAllyLogin;
      const side2IsAlly = !!localAllyLogin && side2?.login === localAllyLogin;

      (data.animals1 ?? []).forEach((animal) => {
        const hpPercent = this.fightDomain.animalHpPercent(animal);
        if (hpPercent === undefined) {
          this.stateStore.logDebug(`animals1 payload missing hp fields: ${JSON.stringify(animal)}`);
        }
        this.scene.updateAnimalBar(animal.name, hpPercent, side1IsAlly);
      });
      (data.animals2 ?? []).forEach((animal) => {
        const hpPercent = this.fightDomain.animalHpPercent(animal);
        if (hpPercent === undefined) {
          this.stateStore.logDebug(`animals2 payload missing hp fields: ${JSON.stringify(animal)}`);
        }
        this.scene.updateAnimalBar(animal.name, hpPercent, side2IsAlly);
      });
    } else {
      const self = (data.fighters1 ?? []).find((it) => it.login === this.sessionStore.username());
      if (self?.login) {
        this.stateStore.syncLocalFighterFromPayload(self);
        this.scene.updateFighterBars(self.login, this.stateStore.userHpPercent(self), this.stateStore.userChakraPercent(self));
      }
      if (data.boss) {
        this.scene.updateBossBar(this.fightDomain.toPercent(data.boss.currentHP, data.boss.maxHp));
      }
      (data.animals1 ?? []).forEach((animal) => {
        const hpPercent = this.fightDomain.animalHpPercent(animal);
        if (hpPercent === undefined) {
          this.stateStore.logDebug(`pve animals payload missing hp fields: ${JSON.stringify(animal)}`);
        }
        this.scene.updateAnimalBar(animal.name, hpPercent, true);
      });
    }
  }

  private computeTurnLabel(currentName: string): string {
    if (currentName === this.sessionStore.username()) {
      return this.transl.transform('Your turn!');
    }
    if (currentName === '') {
      return this.transl.transform('Prepare!');
    }
    return currentName + '\'s ' + this.transl.transform('turn!');
  }

  private reportTurnTimeout(): void {
    this.fightApi.reportTimeout(this.stateStore.fightId(), this.stateStore.current()).subscribe({
      error: (error) => {
        if (error?.status === 404) {
          // Fight can disappear immediately after completion; stop timeout retries.
          clearInterval(this.timer);
          this.stateStore.setCurrentTurn('');
          this.timeoutReported = true;
          return;
        }
        this.timeoutReported = false;
      }
    });
  }

  private loadSummonPreviewIcon(): void {
    this.fightApi.getMyAnimal().subscribe({
      next: (animal) => this.stateStore.setSummonPreviewName(animal?.name),
      error: () => this.stateStore.setSummonPreviewName('')
    });
  }
}
