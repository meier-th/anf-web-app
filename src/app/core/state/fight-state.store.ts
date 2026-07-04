import {Injectable, computed, signal} from '@angular/core';
import {Boss} from '../../classes/boss';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {Combatant, FightRoster} from '../domain/fight-combat.types';
import {FightDomainService} from '../domain/fight-domain.service';
import {FIGHT_CONSTANTS, FIGHT_UI} from '../constants/app.constants';
import {SessionStore} from './session.store';

/**
 * Single source of truth for one fight session: roster, turn, skills,
 * and the small bounded logs the debug panel/attack log show.
 *
 * Owns no DOM, HTTP, or websocket concerns - just data plus the handful
 * of read helpers (percentages, eligibility) that need roster context.
 */
@Injectable()
export class FightStateStore {
  private readonly _allies = signal<User[]>([]);
  private readonly _enemies = signal<User[]>([]);
  private readonly _boss = signal<Boss | undefined>(undefined);
  private readonly _animals1 = signal<NinjaAnimal[]>([]);
  private readonly _animals2 = signal<NinjaAnimal[]>([]);
  private readonly _died = signal<string[]>([]);
  private readonly _skills = signal<string[]>([]);
  private readonly _map = signal<{ [key: string]: string }>({});
  private readonly _selectedSpell = signal<string>(FIGHT_CONSTANTS.defaultSkill);
  private readonly _current = signal<string>('');
  private readonly _loaded = signal(false);
  private readonly _type = signal<'pvp' | 'pve'>('pve');
  private readonly _fightId = signal<string>('');
  private readonly _fightEnded = signal(false);
  private readonly _summonEnabled = signal(true);
  private readonly _useSummonIconFallback = signal(false);
  private readonly _pvpCurrentUserIsBackendSecond = signal(false);
  private readonly _debugLines = signal<string[]>([]);
  private readonly _showDebugPanel = signal(false);
  private readonly _attackEvents = signal<string[]>([]);
  private readonly _localPlayerDead = signal(false);

  private readonly userMaxHp: { [login: string]: number } = {};
  private readonly userMaxChakra: { [login: string]: number } = {};

  readonly allies = computed(() => this._allies());
  readonly enemies = computed(() => this._enemies());
  readonly boss = computed(() => this._boss());
  readonly animals1 = computed(() => this._animals1());
  readonly animals2 = computed(() => this._animals2());
  readonly skills = computed(() => this._skills());
  readonly map = computed(() => this._map());
  readonly selectedSpell = computed(() => this._selectedSpell());
  readonly current = computed(() => this._current());
  readonly loaded = computed(() => this._loaded());
  readonly type = computed(() => this._type());
  readonly fightId = computed(() => this._fightId());
  readonly fightEnded = computed(() => this._fightEnded());
  readonly summonEnabled = computed(() => this._summonEnabled());
  readonly useSummonIconFallback = computed(() => this._useSummonIconFallback());
  readonly debugLines = computed(() => this._debugLines());
  readonly showDebugPanel = computed(() => this._showDebugPanel());
  readonly attackEvents = computed(() => this._attackEvents());
  readonly pvpCurrentUserIsBackendSecond = computed(() => this._pvpCurrentUserIsBackendSecond());

  constructor(private fightDomain: FightDomainService, private sessionStore: SessionStore) {
  }

  initSession(type: string, id: string): void {
    this._type.set(type.toLowerCase() === 'pvp' ? 'pvp' : 'pve');
    this._fightId.set(id);
    this._loaded.set(false);
    this._fightEnded.set(false);
    this._localPlayerDead.set(false);
    this._died.set([]);
    this._skills.set([]);
    this._map.set({});
    this._selectedSpell.set(FIGHT_CONSTANTS.defaultSkill);
    this._debugLines.set([]);
    this._attackEvents.set([]);
  }

  setRoster(allies: User[], enemies: User[], animals1: NinjaAnimal[], animals2: NinjaAnimal[], boss?: Boss): void {
    this._allies.set(allies);
    this._enemies.set(enemies);
    this._animals1.set(animals1);
    this._animals2.set(animals2);
    this._boss.set(boss);
  }

  setPvpCurrentUserIsBackendSecond(value: boolean): void {
    this._pvpCurrentUserIsBackendSecond.set(value);
  }

  seedFighterMaxStats(login: string, maxHp?: number, maxChakra?: number): void {
    if (maxHp !== undefined && maxHp > 0) {
      this.userMaxHp[login] = maxHp;
    }
    if (maxChakra !== undefined && maxChakra > 0) {
      this.userMaxChakra[login] = maxChakra;
    }
  }

  setSkills(skills: string[], map: { [key: string]: string }): void {
    this._skills.set(skills);
    this._map.set(map);
  }

  setLoaded(loaded: boolean): void {
    this._loaded.set(loaded);
  }

  setSummonEnabled(enabled: boolean): void {
    this._summonEnabled.set(enabled);
  }

  setUseSummonIconFallback(useFallback: boolean): void {
    this._useSummonIconFallback.set(useFallback);
  }

  addSummonedAnimal(animal: NinjaAnimal, ally: boolean): boolean {
    if (ally) {
      if (this._animals1().some((it) => it.name === animal.name)) {
        return false;
      }
      this._animals1.set([...this._animals1(), animal]);
      return true;
    }
    if (this._animals2().some((it) => it.name === animal.name)) {
      return false;
    }
    this._animals2.set([...this._animals2(), animal]);
    return true;
  }

  setCurrentTurn(login: string): void {
    this._current.set(login);
  }

  selectSpell(skill: string): void {
    this._selectedSpell.set(skill);
  }

  ensureSelectedSpellIsAvailable(): void {
    const selected = this._selectedSpell();
    if (selected.toLowerCase() === FIGHT_CONSTANTS.defaultSkill.toLowerCase()) {
      return;
    }
    if (this.isSkillDisabled(selected)) {
      this._selectedSpell.set(FIGHT_CONSTANTS.defaultSkill);
    }
  }

  isSkillDisabled(skill: string): boolean {
    return this.fightDomain.isSkillDisabled(skill, this.resolveLocalSummoner());
  }

  resolveLocalSummoner(): User | undefined {
    const username = this.sessionStore.username();
    return this._allies().find((ally) => ally?.login === username) ?? this._allies()[0];
  }

  resolveLocalSummonerLevel(): number {
    const summoner = this.resolveLocalSummoner();
    return this.fightDomain.readNumber(summoner?.stats, 'level')
      ?? this.fightDomain.readNumber(summoner, 'level')
      ?? 1;
  }

  findLocalUserByLogin(login: string | undefined): User | undefined {
    if (!login) {
      return undefined;
    }
    return [...this._allies(), ...this._enemies()].find((it) => it?.login === login);
  }

  /**
   * Accepts either a roster `User` or a raw server payload shape - both
   * carry `.login`/`.character` and FightDomainService falls back to the
   * cached max stats (and the local roster copy) when fields are missing.
   */
  userHpPercent(user: any): number | undefined {
    return this.fightDomain.userHpPercent(user, this.userMaxHp, (login) => this.findLocalUserByLogin(login));
  }

  userChakraPercent(user: any): number | undefined {
    return this.fightDomain.userChakraPercent(user, this.userMaxChakra, (login) => this.findLocalUserByLogin(login));
  }

  applyBossDamage(damage: number): number | undefined {
    const boss = this._boss();
    if (!boss) {
      return undefined;
    }
    boss.currentHP = Math.max(0, boss.currentHP - damage);
    return boss.maxHp > 0 ? this.fightDomain.toPercent(boss.currentHP, boss.maxHp) : undefined;
  }

  syncLocalFighterFromPayload(participant: { login?: string; character?: any }): void {
    if (!participant?.login) {
      return;
    }
    const local = this.findLocalUserByLogin(participant.login);
    if (!local?.character) {
      return;
    }
    const payloadCharacter = participant.character ?? {};
    const payloadCurrentHp = this.fightDomain.readNumber(payloadCharacter, 'currentHP', 'currentHp', 'hp');
    const payloadCurrentChakra = this.fightDomain.readNumber(payloadCharacter, 'currentChakra', 'currentchakra', 'chakra');
    if (payloadCurrentHp !== undefined) {
      local.character.currentHP = Math.max(0, payloadCurrentHp);
    }
    if (payloadCurrentChakra !== undefined) {
      local.character.currentChakra = Math.max(0, payloadCurrentChakra);
    }
  }

  recordCombatantDeath(target: Combatant): void {
    if (target.kind === 'user') {
      if (target.ref.login === this.sessionStore.username()) {
        this._localPlayerDead.set(true);
      }
      if (this._type() !== 'pvp') {
        this._died.set([...this._died(), target.ref.login]);
      }
    }
  }

  hasLocalPlayerDied(): boolean {
    return this._died().includes(this.sessionStore.username());
  }

  isLocalPlayerDead(): boolean {
    return this._localPlayerDead();
  }

  markFightEnded(): void {
    this._fightEnded.set(true);
  }

  logAttackEvent(eventText: string): void {
    const time = new Date().toLocaleTimeString();
    const next = [`[${time}] ${eventText}`, ...this._attackEvents()];
    this._attackEvents.set(next.slice(0, FIGHT_UI.maxAttackEvents));
  }

  logDebug(message: string): void {
    console.debug(`[FightDebug] ${message}`);
    if (!this._showDebugPanel()) {
      return;
    }
    const time = new Date().toLocaleTimeString();
    const next = [`[${time}] ${message}`, ...this._debugLines()];
    this._debugLines.set(next.slice(0, FIGHT_UI.maxDebugLines));
  }

  snapshotRoster(): FightRoster {
    return {
      type: this._type(),
      mySide: {users: this._allies(), animals: this._animals1()},
      otherSide: {users: this._enemies(), animals: this._animals2()},
      boss: this._boss(),
      pvpCurrentUserIsBackendSecond: this._pvpCurrentUserIsBackendSecond()
    };
  }
}
