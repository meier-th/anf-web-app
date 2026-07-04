import {
  AfterContentInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef, OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {FightService} from '../services/fight/fight.service';
import {FightEndService} from '../services/fight-end.service';
import {User} from '../classes/user';
import {Boss} from '../classes/boss';
import {CharacterComponent} from '../character/character.component';
import {HttpClient} from '@angular/common/http';
import {Character} from '../classes/character';
import {animate, state, style, transition, trigger} from '@angular/animations';
import SockJS from 'sockjs-client';
import {Stomp} from '@stomp/stompjs';
import {Router} from '@angular/router';
import {TranslateService} from '../services/translate.service';
import {TranslatePipe} from '../services/translate.pipe';
import {NinjaAnimal} from '../classes/ninja-animal';
import {ApiConfigService} from '../core/config/api-config.service';
import {SessionStore} from '../core/state/session.store';
import {FightApiService} from '../core/api/fight-api.service';
import {FightDomainService} from '../core/domain/fight-domain.service';
import {APP_TIMINGS, FIGHT_CONSTANTS, FIGHT_MESSAGES, FIGHT_UI} from '../core/constants/app.constants';
import {FightRenderService} from '../core/ui/fight-render.service';
import { Tooltip } from 'primeng/tooltip';
import { FightResultComponent } from '../fight-result/fight-result.component';

type AttackAnnouncement = {
  id: number;
  text: string;
  dismissTimer: ReturnType<typeof setTimeout>;
};

@Component({
    selector: 'app-fight',
    templateUrl: './fight.component.html',
    styleUrls: ['./fight.component.less'],
    animations: [
        trigger('turn', [
            state('disabled', style({
                opacity: 0.3
            })),
            state('enabled', style({
                opacity: 1
            })),
            transition('disabled => enabled', [
                animate('0.2s')
            ]),
            transition('enabled => disabled', [
                animate('0.3s')
            ])
        ])
    ],
    imports: [Tooltip, FightResultComponent, TranslatePipe]
})
export class FightComponent implements OnInit, OnDestroy {
  private readonly summonAnimalPreviewByRace: {
    [race: string]: {
      tier1: string;
      tier2: string;
    };
  } = {
    veseliba: {tier1: 'vertet', tier2: 'ubele'},
    bojajumus: {tier1: 'lauva', tier2: 'lusis'},
    lidzsvaru: {tier1: 'erglis', tier2: 'lapsa'},
    bugurt: {tier1: 'aunt-ass', tier2: 'uncle-baphomet'}
  };
  allies: User[] = [];
  enemies: User[] = [];
  boss: Boss;
  died: string[] = [];
  animals1: NinjaAnimal[] = [];
  animals2: NinjaAnimal[] = [];
  @ViewChild('alliesContainer', {read: ViewContainerRef}) alliesContainer;
  @ViewChild('enemiesContainer', {read: ViewContainerRef}) enemiesContainer;
  fightersElements: { [key: string]: HTMLElement } = {};
  statsElements: { [key: string]: HTMLElement } = {};
  skills: string[] = [];
  loaded = false;
  type: string;
  private stompClient;
  id: string;
  selectedSpell: string = FIGHT_CONSTANTS.defaultSkill;
  map: { [key: string]: string } = {};
  timer: ReturnType<typeof setInterval>;
  current: string;
  summonEnabled = true;
  animalsElements: { [key: string]: HTMLElement } = {};
  attackEvents: string[] = [];
  private userMaxHp: { [login: string]: number } = {};
  private userMaxChakra: { [login: string]: number } = {};
  announcements: AttackAnnouncement[] = [];
  private announcementCounter = 0;
  private pendingAnnouncementDelays: Array<ReturnType<typeof setTimeout>> = [];
  private timeoutReported = false;
  private fightEnded = false;
  showFightResult = false;
  private ratingBeforeFight: number | undefined;
  private localPlayerDead = false;
  private bossElement?: HTMLElement;
  debugLines: string[] = [];
  showDebugPanel = false;
  private pvpCurrentUserIsBackendSecond = false;
  private useSummonIconFallback = false;

  get currentUsername(): string {
    return this.sessionStore.username();
  }

  constructor(private router: Router, private transl: TranslatePipe,
              private fightService: FightService,
              private resolver: ComponentFactoryResolver, private http: HttpClient,
              private endServ: FightEndService, private apiConfig: ApiConfigService,
              private sessionStore: SessionStore, private fightApi: FightApiService,
              private fightDomain: FightDomainService, private fightRender: FightRenderService) {
  }

  ngOnInit() {
    this.endServ.death = false;
    this.endServ.loss = false;
    this.endServ.victory = false;
    this.endServ.surrendered = false;
    if (!this.fightService.valuesSet) {
      const segments = this.router.url.split('/').filter((segment) => segment.length > 0);
      this.type = segments[1] ?? '';
      this.id = segments[2] ?? '';
    } else {
      this.id = this.fightService.id;
      this.type = this.fightService.type;
    }
    this.initializeWebSockets();
    this.getFightInfo(this.type);
    this.captureRatingBeforeFight();
  }

  initializeWebSockets() {
    const ws = new SockJS(this.apiConfig.buildUrl('/socket'));
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      // PVP
      if (that.type === 'pvp') {
        that.stompClient.subscribe('/user/fightState', (response) => {
          const fightState = <{
            attacker: string,
            target: string,
            attackName: string,
            chakraCost: number,
            damage: number,
            chakraBurn: number,
            deadly: boolean,
            everyoneDead: boolean,
            nextAttacker: string
          }>JSON.parse(response.body);
          that.pushDebug(`WS PVP ${fightState.attacker} -> ${fightState.target} (${fightState.attackName}) dmg=${fightState.damage}`);
          that.scheduleAttackAnnouncement(fightState);
          that.appendAttackEvent(
            `${fightState.attacker} -> ${fightState.target}: ${fightState.damage} (${fightState.attackName})`);
          that.setTimer(fightState.nextAttacker, APP_TIMINGS.fightTurnWindowMs);
          if (that.isSurrenderState(fightState)) {
            that.handleSurrenderState(fightState);
            return;
          }
          that.animateAttackVisual(fightState.attacker, fightState.target, fightState.attackName);

          // find attacker and target
          let attackerUser: User;
          let targetUser: User;
          let attackerAnimal: NinjaAnimal;
          let targetAnimal: NinjaAnimal;
          let userIsAttacker: boolean;
          let userIsTarget: boolean;
          let yourSideAttacks: boolean;

          // if enemy user attacks
          if (that.enemies.map(us => us.login).includes(fightState.attacker)) {
            attackerUser = that.enemies.find(us => us.login === fightState.attacker);
            userIsAttacker = true;
            yourSideAttacks = false;
            // your animal is a target
            if (that.findAnimalByToken(that.animals1, fightState.target)) {
              targetAnimal = that.findAnimalByToken(that.animals1, fightState.target);
              userIsTarget = false;
            } else {
              targetUser = that.allies.find(us => us.login === fightState.target);
              userIsTarget = true;
            }
          } else if (that.allies.map(us => us.login).includes(fightState.attacker)) {
            attackerUser = that.allies.find(us => us.login === fightState.attacker);
            userIsAttacker = true;
            yourSideAttacks = true;
            // enemy user is a target
            if (that.enemies.map(enemy => enemy.login).includes(fightState.target)) {
              targetUser = that.enemies.find(us => us.login === fightState.target);
              userIsTarget = true;
            } else {
              targetAnimal = that.findAnimalByToken(that.animals2, fightState.target);
              userIsTarget = false;
            }
          } else if (that.findAnimalByToken(that.animals1, fightState.attacker)) {
            attackerAnimal = that.findAnimalByToken(that.animals1, fightState.attacker);
            userIsAttacker = false;
            yourSideAttacks = true;
            // enemy user is a target
            if (that.enemies.map(enemy => enemy.login).includes(fightState.target)) {
              targetUser = that.enemies.find(us => us.login === fightState.target);
              userIsTarget = true;
            } else {
              targetAnimal = that.findAnimalByToken(that.animals2, fightState.target);
              userIsTarget = false;
            }
          } else {
            attackerAnimal = that.findAnimalByToken(that.animals2, fightState.attacker);
            userIsAttacker = false;
            yourSideAttacks = false;
            // your user is a target
            if (that.allies.map(ally => ally.login).includes(fightState.target)) {
              targetUser = that.allies.find(ally => ally.login === fightState.target);
              userIsTarget = true;
            } else {
              targetAnimal = that.findAnimalByToken(that.animals1, fightState.target);
              userIsTarget = false;
            }
          }

          // set hp and chakra for target
          if (userIsTarget && targetUser) {
            targetUser.character.currentHP -= fightState.damage;
            if (targetUser.character.currentHP < 0) {
              targetUser.character.currentHP = 0;
            }
            targetUser.character.currentChakra -= fightState.chakraBurn;
            that.applyUserBars(fightState.target, that.userHpPercent(targetUser), that.userChakraPercent(targetUser));
          } else if (targetAnimal) {
            const hpPercent = that.applyDamageToAnimal(targetAnimal, fightState.damage);
            that.applyAnimalBar(fightState.target, hpPercent, that.animals1.includes(targetAnimal));
          }

          // set chakra for attacker
          if (userIsAttacker && attackerUser) {
            attackerUser.character.currentChakra -= fightState.chakraCost;
            that.applyUserBars(fightState.attacker, undefined, that.userChakraPercent(attackerUser));
          }

          // if deadly
          if (fightState.deadly) {
            if (userIsTarget) {
              if (targetUser) {
                that.setUserDead(targetUser); // method for graphics
              }
            } else if (targetAnimal) {
              that.setAnimalDead(targetAnimal);
            }

            // if everyone is dead
            if (fightState.everyoneDead) {
              // find who has won
              let victory: boolean;
              let loss: boolean;
              if (yourSideAttacks) {
                victory = true;
                loss = false;
              } else {
                victory = false;
                loss = true;
              }
              // finish
              that.finishFight(false, victory, loss);
            }
          }
          that.syncBarsFromServer();
        });
      } else {
        that.stompClient.subscribe('/user/fightState', (response) => {
          const fightState = <{
            attacker: string,
            target: string,
            attackName: string,
            chakraCost: number,
            damage: number,
            chakraBurn: number,
            deadly: boolean,
            everyoneDead: boolean,
            nextAttacker: string
          }>JSON.parse(response.body);
          that.pushDebug(`WS PVE ${fightState.attacker} -> ${fightState.target} (${fightState.attackName}) dmg=${fightState.damage}`);
          that.scheduleAttackAnnouncement(fightState);
          that.appendAttackEvent(
            `${fightState.attacker} -> ${fightState.target}: ${fightState.damage} (${fightState.attackName})`);
          that.setTimer(fightState.nextAttacker, APP_TIMINGS.fightTurnWindowMs);
          if (that.isSurrenderState(fightState)) {
            that.handleSurrenderState(fightState);
            return;
          }
          that.animateAttackVisual(fightState.attacker, fightState.target, fightState.attackName);

          // find attacker and target
          let attackerUser: User;
          let attackerAnimal: NinjaAnimal;
          let bossIsAttacker: boolean;
          let animalIsAttacker: boolean;
          let userIsAttacker: boolean;
          let bossIsTarget: boolean;
          let animalIsTarget: boolean;
          let userIsTarget: boolean;
          const boss = that.boss;
          let targetUser: User;
          let targetAnimal: NinjaAnimal;
          animalIsAttacker = !!that.findAnimalByToken(that.animals1, fightState.attacker);
          userIsAttacker = that.allies.some((all) => all.login === fightState.attacker);
          if (userIsAttacker) {
            attackerUser = that.allies.find(all => all.login === fightState.attacker);
            bossIsAttacker = false;
            userIsAttacker = true;
            animalIsAttacker = false;
            bossIsTarget = true;
            userIsTarget = false;
            animalIsTarget = false;
          } else if (animalIsAttacker) {
            attackerAnimal = that.findAnimalByToken(that.animals1, fightState.attacker);
            bossIsAttacker = false;
            userIsAttacker = false;
            animalIsAttacker = true;
            bossIsTarget = true;
            userIsTarget = false;
            animalIsTarget = false;
          } else {
            bossIsAttacker = true;
            userIsAttacker = false;
            animalIsAttacker = false;
            bossIsTarget = false;
            if (that.allies.map(ally => ally.login).includes(fightState.target)) {
              targetUser = that.allies.find(ally => ally.login === fightState.target);
              userIsTarget = true;
              animalIsTarget = false;
            } else {
              targetAnimal = that.findAnimalByToken(that.animals1, fightState.target);
              userIsTarget = false;
              animalIsTarget = true;
            }
          }

          // set HP and chakra
          // allies attack
          if (userIsAttacker || animalIsAttacker) {
            that.boss.currentHP -= fightState.damage;
            if (that.boss.currentHP < 0) {
              that.boss.currentHP = 0;
            }
            if (that.statsElements[that.boss.numberOfTails]) {
              that.setHPPercent(that.statsElements[that.boss.numberOfTails],
                that.boss.currentHP / that.boss.maxHp * 100);
            }
            if (userIsAttacker && attackerUser) {
              that.applyUserBars(fightState.attacker, undefined, that.userChakraPercent(attackerUser));
            } else {
              // that.setChakraPercent(that.statsElements[fightState.attacker],
              //   attackerAnimal.currentHP / attackerAnimal.maxHP * 100);
            }
          } else {
            if (userIsTarget && targetUser) {
              targetUser.character.currentHP -= fightState.damage;
              if (targetUser.character.currentHP < 0) {
                targetUser.character.currentHP = 0;
              }
              that.applyUserBars(fightState.target, that.userHpPercent(targetUser), undefined);
            } else if (targetAnimal) {
              try {
                const hpPercent = that.applyDamageToAnimal(targetAnimal, fightState.damage);
                that.applyAnimalBar(
                  fightState.target,
                  hpPercent,
                  that.animals1.includes(targetAnimal));
              } catch (e) {

              }
            }
          }

          // check if deadly
          if (fightState.deadly) {
            // if boss killed someone
            if (bossIsAttacker) {
              if (animalIsTarget && targetAnimal) {
                that.setAnimalDead(targetAnimal);
              } else if (targetUser) {
                that.setUserDead(targetUser);
              }
              // if boss has won
              if (fightState.everyoneDead) {
                that.finishFight(false, false, true); // you lost
              }
            } else {
          if (that.died.includes(that.sessionStore.username())) {
                that.finishFight(true, false, false);
              } else {
                that.finishFight(false, true, false);
              } // you won
            }
          }
          that.syncBarsFromServer();
        });
      }
      that.stompClient.subscribe('/user/switch', (response) => {
        that.pushDebug(`WS switch next=${response.body}`);
        that.setTimer(response.body, APP_TIMINGS.fightTurnTickMs);
        that.syncBarsFromServer();
      });
      that.stompClient.subscribe('/user/summon', (response) => {
        const animalState = <{
          summoner: string,
          name: string,
          race: string,
          maxHp: number,
          damage: number,
        }>JSON.parse(response.body);
        const animal: NinjaAnimal = new NinjaAnimal();
        animal.currentChakra = 100;
        animal.damage = animalState.damage;
        animal.maxHP = animalState.maxHp;
        animal.name = animalState.name;
        animal.race = animalState.race;
        animal.currentHP = animal.maxHP;
        if (that.allies.map(ally => ally.login).includes(animalState.summoner)) {
          if (!that.animals1.some((it) => it.name === animal.name)) {
            that.animals1.push(animal);
            that.drawAnimal(animal, true);
          }
        } else {
          if (!that.animals2.some((it) => it.name === animal.name)) {
            that.animals2.push(animal);
            that.drawAnimal(animal, false);
          }
        }
        that.syncBarsFromServer();
      });
    });
  }

  init() {
    const factory = this.resolver.resolveComponentFactory(CharacterComponent);
    let character: ComponentRef<CharacterComponent>;
    for (let i = 0; i < this.allies.length; i++) {
      character = this.alliesContainer.createComponent(factory);
      const genderId = this.allies[this.allies.length - i - 1].character.appearance.gender === 'FEMALE' ? 1 : 0;
      const root = <HTMLElement>character.location.nativeElement;
      const element = <HTMLElement>root.querySelector(genderId === 1 ? '.female' : '.male');
      const hidden = <HTMLElement>root.querySelector(genderId === 1 ? '.male' : '.female');
      const stats = <HTMLElement>root.querySelector('.powers');
      if (!element || !hidden || !stats) {
        continue;
      }
      this.fightersElements[this.allies[this.allies.length - i - 1].login] = element;
      element.style.display = 'block';
      this.setPosition(element, i);
      hidden.style.display = 'none';
      stats.dataset.login = this.allies[this.allies.length - i - 1].login;
      this.statsElements[this.allies[this.allies.length - i - 1].login] = stats;
      this.setPosition(stats, i, 125);

      (<HTMLElement>stats
        .getElementsByClassName('name')[0])
        .innerText = this.allies[this.allies.length - i - 1].login;
      this.applyUserBars(
        this.allies[this.allies.length - i - 1].login,
        this.userHpPercent(this.allies[this.allies.length - i - 1]),
        this.userChakraPercent(this.allies[this.allies.length - i - 1]));
      this.setAppearance(element, this.allies[this.allies.length - i - 1]);
    }
    if (this.type === 'pvp') {
      character = this.enemiesContainer.createComponent(factory);
      const genderId = this.enemies[0].character.appearance.gender === 'FEMALE' ? 1 : 0;
      const root = <HTMLElement>character.location.nativeElement;
      const element = <HTMLElement>root.querySelector(genderId === 1 ? '.female' : '.male');
      const hidden = <HTMLElement>root.querySelector(genderId === 1 ? '.male' : '.female');
      const stats = <HTMLElement>root.querySelector('.powers');
      if (!element || !hidden || !stats) {
        return;
      }
      this.fightersElements[this.enemies[0].login] = element;
      element.style.display = 'block';
      element.classList.add('enemy');
      hidden.style.display = 'none';
      this.setAppearance(element, this.enemies[0]);
      stats.dataset.login = this.enemies[0].login;
      this.statsElements[this.enemies[0].login] = stats;
      this.applyUserBars(this.enemies[0].login, this.userHpPercent(this.enemies[0]), this.userChakraPercent(this.enemies[0]));
      const login = this.enemies[0].login;
      (<HTMLElement>stats
        .getElementsByClassName('name')[0])
        .innerText = login;
      element.addEventListener('click', () => {
        this.attack(login);
      });
      element.classList.add('enemy-target');
    } else {
      const boss = this.enemiesContainer.createComponent(factory);
      boss.instance.bossId = this.boss.numberOfTails;
      this.statsElements[this.boss.numberOfTails] = (<HTMLElement>(<HTMLElement>boss
        .location.nativeElement).childNodes[0]);
      (<HTMLElement>boss.location.nativeElement).style.position = 'absolute';
      (<HTMLElement>boss.location.nativeElement).style.bottom = '-40px';
      (<HTMLElement>boss.location.nativeElement).style.right = '20px';
      this.bossElement = <HTMLElement>boss.location.nativeElement;
      (<HTMLElement>boss.location.nativeElement).addEventListener('click', () => {
        this.attack(boss.instance.bossId);
      });
      (<HTMLElement>boss.location.nativeElement).classList.add('enemy-target');

    }
    this.updateTargetCursor();
  }

  getFightInfo(type: string) {
    if (type.toLowerCase() === 'pvp') {
      this.fightApi.getInfo<{
        id: number, type: string,
        fighters1: User, fighters2: User,
        animals1: NinjaAnimal[], animals2: NinjaAnimal[],
        currentName: string, timeLeft: number
      }>(this.id).subscribe((data) => {
        this.setTimer(data.currentName, data.timeLeft);
        this.pvpCurrentUserIsBackendSecond = data.fighters2.login === this.sessionStore.username();
        if (this.pvpCurrentUserIsBackendSecond) {
          const tmp = data.fighters1;
          data.fighters1 = data.fighters2;
          data.fighters2 = tmp;
          const tmpAnimals = data.animals1;
          data.animals1 = data.animals2;
          data.animals2 = tmpAnimals;
        }
        this.allies = [data.fighters1];
        this.useSummonIconFallback = false;
        this.summonEnabled = this.summonEnabled && this.allies[0].character.animalRace != null;
        this.enemies = [data.fighters2];
        [data.fighters1, data.fighters2].forEach((fighter) => {
          if (fighter?.login) {
            const maxHp = this.readNumber(fighter?.character, 'maxHp', 'maxHP', 'hpAmount');
            const maxChakra = this.readNumber(fighter?.character, 'maxChakra', 'maxchakra', 'chakraAmount');
            if (maxHp !== undefined && maxHp > 0) {
              this.userMaxHp[fighter.login] = maxHp;
            }
            if (maxChakra !== undefined && maxChakra > 0) {
              this.userMaxChakra[fighter.login] = maxChakra;
            }
          }
        });
        this.animals1 = data.animals1 ?? [];
        this.animals2 = data.animals2 ?? [];
        const spells = data.fighters1.character.spellsKnown;
        this.skills.push(FIGHT_CONSTANTS.defaultSkill);
        this.map[FIGHT_CONSTANTS.defaultSkill] = `${FIGHT_CONSTANTS.defaultSkill}\n` +
          this.transl.transform('Damage') + ': ' + data.fighters1.character.physicalDamage +
          '\n' + this.transl.transform('Chakra') + ': 0';
        spells.forEach((it) => {
          this.skills.push(it.spellUse.name);
          this.map[it.spellUse.name] = it.spellUse.name +
            '\n' + this.transl.transform('Damage') + ':' + (it.spellUse.baseDamage) +
            '\n' + this.transl.transform('Chakra') + ': ' + it.spellUse.baseChakraConsumption;
        });
        this.loaded = true;
        this.init();
        this.animals1.forEach((animal) => this.drawAnimal(animal, true));
        this.animals2.forEach((animal) => this.drawAnimal(animal, false));
      });
      if (this.animals1.length > 0) {
        this.summonEnabled = false;
      }
    } else {
      this.fightApi.getInfo<{
        id: number, type: string, fighters1: User[], currentName: string, timeLeft: number,
        boss: Boss, animals1: NinjaAnimal[]
      }>(this.id).subscribe((data) => {
        this.setTimer(data.currentName, data.timeLeft);
        this.allies = data.fighters1;
        this.useSummonIconFallback = false;
        this.allies.forEach((fighter) => {
          if (fighter?.login) {
            const maxHp = this.readNumber(fighter?.character, 'maxHp', 'maxHP', 'hpAmount');
            const maxChakra = this.readNumber(fighter?.character, 'maxChakra', 'maxchakra', 'chakraAmount');
            if (maxHp !== undefined && maxHp > 0) {
              this.userMaxHp[fighter.login] = maxHp;
            }
            if (maxChakra !== undefined && maxChakra > 0) {
              this.userMaxChakra[fighter.login] = maxChakra;
            }
          }
        });
        this.boss = data.boss;
        const localFighter = data.fighters1.find((us) => us.login === this.sessionStore.username()) ?? data.fighters1[0];
        const spells = localFighter?.character?.spellsKnown ?? [];
        this.skills.push(FIGHT_CONSTANTS.defaultSkill);
        this.map[FIGHT_CONSTANTS.defaultSkill] = `${FIGHT_CONSTANTS.defaultSkill}\n` +
          this.transl.transform('Damage') + ': ' +
          (localFighter?.character?.physicalDamage ?? 0) + '\n' + this.transl.transform('Chakra') + ': 0';
        spells.forEach((it) => {
          this.skills.push(it.spellUse.name);
          this.map[it.spellUse.name] = it.spellUse.name +
            '\n' + this.transl.transform('Damage') + ': ' +
            (it.spellUse.baseDamage) + '\n' + this.transl.transform('Chakra') +
            ': ' + it.spellUse.baseChakraConsumption;
        });
        this.loaded = true;
        this.init();
        this.animals1 = data.animals1;
        for (let i = 0; i < data.animals1.length; i++) {
          this.drawAnimal(data.animals1[i], true);
          if (data.animals1[i].summoner === this.sessionStore.username()) {
            this.summonEnabled = false;
          }
        }
      });
    }
  }

  setTimer(currentName: string, timeLeft: number) {
    clearInterval(this.timer);
    this.timeoutReported = false;
    this.current = currentName;
    this.updateTargetCursor();
    if (currentName === this.sessionStore.username()) {
      currentName = this.transl.transform('Your turn!');
    } else {
      if (currentName === '') {
        currentName = this.transl.transform('Prepare!');
      } else {
        currentName = currentName + '\'s ' + this.transl.transform('turn!');
      }
    }
    const currentElement = document.getElementById('current');
    const timerElement = document.getElementById('timer');
    if (currentElement) {
      currentElement.innerText = currentName;
    }
    if (timerElement) {
      timerElement.innerText = Math.max(0, Math.ceil(timeLeft / FIGHT_UI.timerStepMs)).toString();
    }
    this.timer = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - FIGHT_UI.timerStepMs);
      if (timerElement) {
        timerElement.innerText = Math.max(0, Math.ceil(timeLeft / FIGHT_UI.timerStepMs)).toString();
      }
      if (timeLeft === 0 && this.current && !this.timeoutReported) {
        this.timeoutReported = true;
        this.reportTurnTimeout();
      }
    }, FIGHT_UI.timerStepMs);
  }

  private reportTurnTimeout() {
    this.fightApi.reportTimeout(this.id, this.current).subscribe({
      error: (error) => {
        if (error?.status === 404) {
          // Fight can disappear immediately after completion; stop timeout retries.
          clearInterval(this.timer);
          this.current = '';
          this.timeoutReported = true;
          return;
        }
        this.timeoutReported = false;
      }
    });
  }

  private captureRatingBeforeFight() {
    if ((this.type ?? '').toLowerCase() !== 'pvp') {
      this.ratingBeforeFight = 0;
      return;
    }
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true})
      .subscribe((profile) => {
        this.ratingBeforeFight = profile?.stats?.rating;
      });
  }

  private isSurrenderState(fightState: { attackName?: string }): boolean {
    return (fightState?.attackName ?? '').toLowerCase() === FIGHT_CONSTANTS.surrenderAttackName;
  }

  private handleSurrenderState(fightState: { attacker?: string }) {
    if ((this.type ?? '').toLowerCase() === 'pvp') {
      const surrenderedBySelf = (fightState?.attacker ?? '') === this.sessionStore.username();
      this.finishFight(false, !surrenderedBySelf, surrenderedBySelf, true);
      return;
    }
    this.finishFight(false, false, true, true);
  }

  private resolveRatingChangeAndShowResult() {
    if ((this.type ?? '').toLowerCase() !== 'pvp') {
      this.endServ.ratingChange = 0;
      this.http.get<any[]>(this.apiConfig.buildUrl('/profile/pvehistory'), {withCredentials: true})
        .subscribe({
          next: (history) => {
            const latestResult = `${history?.[0]?.result ?? ''}`.toLowerCase();
            if (latestResult === 'win') {
              this.endServ.victory = true;
              this.endServ.loss = false;
              this.endServ.death = false;
            } else if (latestResult === 'died') {
              this.endServ.victory = false;
              this.endServ.loss = false;
              this.endServ.death = true;
            } else if (latestResult === 'loss') {
              this.endServ.victory = false;
              this.endServ.loss = true;
            }
            this.showFightResult = true;
          },
          error: () => {
            this.showFightResult = true;
          }
        });
      return;
    }
    this.http.get<User>(this.apiConfig.buildUrl('/profile'), {withCredentials: true})
      .subscribe({
        next: (profile) => {
          const currentRating = profile?.stats?.rating;
          if (Number.isFinite(currentRating) && Number.isFinite(this.ratingBeforeFight)) {
            this.endServ.ratingChange = Number(currentRating) - Number(this.ratingBeforeFight);
          } else {
            this.endServ.ratingChange = 0;
          }
          // PvP outcome should be derived from authoritative rating update.
          this.endServ.victory = this.endServ.ratingChange > 0;
          this.endServ.loss = this.endServ.ratingChange < 0;
          this.endServ.death = this.localPlayerDead;
          this.showFightResult = true;
        },
        error: () => {
          this.endServ.ratingChange = 0;
          this.endServ.death = this.localPlayerDead;
          this.showFightResult = true;
        }
      });
  }

  onFightResultOk() {
    this.showFightResult = false;
    this.router.navigateByUrl('/main');
  }

  attack(enemy: string): any {
    if (this.current !== this.sessionStore.username()) {
      return;
    }
    if (this.isSkillDisabled(this.selectedSpell)) {
      this.selectedSpell = FIGHT_CONSTANTS.defaultSkill;
    }
    this.fightApi.attack(this.id, enemy, this.selectedSpell).subscribe((data: {
      damage: number,
      chakra: number,
      deadly: boolean,
      code: number
    }) => {
      this.syncBarsFromServer();
    }, () => {
    });
  }

  private syncBarsFromServer() {
    if (this.fightEnded) {
      return;
    }
    this.fightApi.getInfo<any>(this.id).subscribe((data: any) => {
      if ((this.type ?? '').toLowerCase() === 'pvp') {
        const side1 = data.fighters1;
        const side2 = data.fighters2;
        [side1, side2].forEach((participant) => {
          if (participant?.login) {
            this.syncLocalFighterFromPayload(participant);
            this.applyUserBars(participant.login, this.userHpPercent(participant), this.userChakraPercent(participant));
          }
        });

        const localAllyLogin = this.allies[0]?.login;
        const side1IsAlly = !!localAllyLogin && side1?.login === localAllyLogin;
        const side2IsAlly = !!localAllyLogin && side2?.login === localAllyLogin;

        (data.animals1 ?? []).forEach((animal) => {
          const hpPercent = this.animalHpPercent(animal);
          if (hpPercent === undefined) {
            this.pushDebug(`animals1 payload missing hp fields: ${JSON.stringify(animal)}`);
          }
          this.applyAnimalBar(animal.name, hpPercent, side1IsAlly);
        });
        (data.animals2 ?? []).forEach((animal) => {
          const hpPercent = this.animalHpPercent(animal);
          if (hpPercent === undefined) {
            this.pushDebug(`animals2 payload missing hp fields: ${JSON.stringify(animal)}`);
          }
          this.applyAnimalBar(animal.name, hpPercent, side2IsAlly);
        });
      } else {
        const self = (data.fighters1 ?? []).find((it) => it.login === this.sessionStore.username());
        if (self?.login) {
          this.syncLocalFighterFromPayload(self);
          this.applyUserBars(self.login, this.userHpPercent(self), this.userChakraPercent(self));
        }
        if (data.boss && this.statsElements[data.boss.numberOfTails]) {
          this.setHPPercent(this.statsElements[data.boss.numberOfTails], data.boss.currentHP / data.boss.maxHp * 100);
        }
        (data.animals1 ?? []).forEach((animal) => {
          const hpPercent = this.animalHpPercent(animal);
          if (hpPercent === undefined) {
            this.pushDebug(`pve animals payload missing hp fields: ${JSON.stringify(animal)}`);
          }
          this.applyAnimalBar(animal.name, hpPercent, true);
        });
      }
    }, (error) => {
      // Fight can be removed immediately after a decisive hit.
      if (error?.status === 404) {
        return;
      }
      console.error(error);
    }, () => {
      this.ensureSelectedSpellIsAvailable();
    });
  }

  summon() {
    this.fightApi.summon(this.type, this.id).subscribe((response: NinjaAnimal) => {
      this.summonEnabled = false;
    });
  }

  get summonButtonSrc(): string {
    if (this.useSummonIconFallback) {
      return '../../assets/summon.png';
    }
    const race = (this.resolveLocalSummoner()?.character?.animalRace ?? '').trim().toLowerCase();
    const animalByRace = this.summonAnimalPreviewByRace[race];
    if (!animalByRace) {
      return '../../assets/summon.png';
    }
    const level = this.resolveLocalSummonerLevel();
    const animalImage = level >= FIGHT_CONSTANTS.summonLevelTwoThreshold
      ? animalByRace.tier2
      : animalByRace.tier1;
    return `../../assets/${animalImage}.png`;
  }

  onSummonButtonImageError() {
    this.useSummonIconFallback = true;
  }

  selectSpell(event: MouseEvent) {
    if (this.current === this.sessionStore.username()) {
      const selectedSpell = (event.target as HTMLElement | null)?.id ?? FIGHT_CONSTANTS.defaultSkill;
      if (this.isSkillDisabled(selectedSpell)) {
        alert(this.transl.transform(FIGHT_MESSAGES.notEnoughChakra));
        this.selectedSpell = FIGHT_CONSTANTS.defaultSkill;
      } else {
        this.selectedSpell = selectedSpell;
      }
      this.updateTargetCursor();
    } else {
      alert(this.transl.transform(FIGHT_MESSAGES.notYourTurn));
    }

  }

  private updateTargetCursor() {
    const cursor = this.current === this.sessionStore.username() ? 'crosshair' : 'default';
    const targets = document.querySelectorAll('.enemy-target');
    targets.forEach((target) => {
      const targetElement = target as HTMLElement;
      targetElement.style.cursor = cursor;
      if (this.current === this.sessionStore.username() && !this.fightEnded && !this.showFightResult) {
        targetElement.classList.add('target-glow');
        targetElement.style.filter = 'drop-shadow(0 0 10px rgba(255, 222, 89, 0.95))';
      } else {
        targetElement.classList.remove('target-glow');
        targetElement.style.filter = '';
      }
    });
    this.pushDebug(`Target highlight active=${this.current === this.sessionStore.username()} count=${targets.length}`);
  }

  private animateAttackVisual(attackerId: string, targetId: string, attackName?: string) {
    if (this.fightEnded || !attackerId || !targetId) {
      return;
    }
    const attackerEl = this.resolveCombatantElement(attackerId);
    const attackerIsAlly = this.isAllyCombatant(attackerId);
    const targetEl = this.resolveCombatantElement(targetId, attackerIsAlly === undefined ? undefined : !attackerIsAlly);
    if (!attackerEl || !targetEl) {
      this.pushDebug(`Projectile skipped attacker=${attackerId}(${!!attackerEl}) target=${targetId}(${!!targetEl})`);
      return;
    }
    this.pushDebug(`Projectile ${attackName ?? 'Physical'} ${attackerId} -> ${targetId}`);
    const start = attackerEl.getBoundingClientRect();
    const end = targetEl.getBoundingClientRect();
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
      this.blinkTargetOnImpact(targetEl);
    };
    projectile.addEventListener('transitionend', cleanup, {once: true});
    setTimeout(cleanup, FIGHT_UI.projectileCleanupMs);
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

  private applyDamageToAnimal(animal: any, damage: number): number | undefined {
    const result = this.fightDomain.applyDamageToAnimal(animal, damage);
    if (result.hpPercent === undefined || result.current === undefined || result.max === undefined || result.max <= 0 || result.next === undefined) {
      this.pushDebug(`Animal damage skipped (missing values) animal=${animal?.name ?? 'unknown'} dmg=${damage}`);
      return undefined;
    }
    this.pushDebug(`Animal damage ${animal?.name ?? 'unknown'}: ${result.current}/${result.max} -> ${result.next}/${result.max} (${Math.round(result.hpPercent ?? 0)}%)`);
    return result.hpPercent;
  }

  private blinkTargetOnImpact(targetEl: HTMLElement) {
    const previousFilter = targetEl.style.filter;
    const previousTransition = targetEl.style.transition;
    targetEl.style.transition = 'filter 0.08s linear';
    targetEl.style.filter = 'brightness(1.6) saturate(1.8) drop-shadow(0 0 12px rgba(255, 40, 40, 0.95))';
    setTimeout(() => {
      targetEl.style.filter = previousFilter;
      targetEl.style.transition = previousTransition;
    }, FIGHT_UI.impactFlashMs);
  }

  private resolveCombatantElement(id: string, preferAllyForAnimal?: boolean): HTMLElement | undefined {
    if (!id) {
      return undefined;
    }
    if (this.fightersElements[id]) {
      return this.fightersElements[id];
    }
    const tokenSide = this.sideFromAnimalToken(id);
    if (tokenSide === 'ally') {
      const allyAnimal = this.findAnimalByToken(this.animals1, id);
      if (allyAnimal) {
        return this.animalsElements[this.getAnimalElementSideKey(allyAnimal.name, true)];
      }
    } else if (tokenSide === 'enemy') {
      const enemyAnimal = this.findAnimalByToken(this.animals2, id);
      if (enemyAnimal) {
        return this.animalsElements[this.getAnimalElementSideKey(enemyAnimal.name, false)];
      }
    } else {
      if (preferAllyForAnimal === true) {
        const allyAnimal = this.findAnimalByToken(this.animals1, id);
        if (allyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(allyAnimal.name, true)];
        }
        const enemyAnimal = this.findAnimalByToken(this.animals2, id);
        if (enemyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(enemyAnimal.name, false)];
        }
      } else if (preferAllyForAnimal === false) {
        const enemyAnimal = this.findAnimalByToken(this.animals2, id);
        if (enemyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(enemyAnimal.name, false)];
        }
        const allyAnimal = this.findAnimalByToken(this.animals1, id);
        if (allyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(allyAnimal.name, true)];
        }
      } else {
        const enemyAnimal = this.findAnimalByToken(this.animals2, id);
        if (enemyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(enemyAnimal.name, false)];
        }
        const allyAnimal = this.findAnimalByToken(this.animals1, id);
        if (allyAnimal) {
          return this.animalsElements[this.getAnimalElementSideKey(allyAnimal.name, true)];
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
    if (this.allies.some((ally) => ally.login === id)) {
      return true;
    }
    if (this.enemies.some((enemy) => enemy.login === id)) {
      return false;
    }
    const tokenSide = this.sideFromAnimalToken(id);
    if (tokenSide === 'ally') {
      return true;
    }
    if (tokenSide === 'enemy') {
      return false;
    }
    if (this.findAnimalByToken(this.animals1, id)) {
      return true;
    }
    if (this.findAnimalByToken(this.animals2, id)) {
      return false;
    }
    return undefined;
  }

  private sideFromAnimalToken(token: string): 'ally' | 'enemy' | undefined {
    const marker = (token ?? '').length > 3 ? token.charAt(3) : '';
    if (marker === '1') {
      return 'ally';
    }
    if (marker === '0') {
      return 'enemy';
    }
    return undefined;
  }

  private scheduleAttackAnnouncement(fightState: {
    attacker: string;
    target: string;
    attackName: string;
    damage: number;
  }) {
    const text = `${fightState.attacker} attacked ${fightState.target} for ${fightState.damage} (${fightState.attackName})`;
    const delay = this.isAnimalAttackAttacker(fightState.attacker) ? FIGHT_UI.announcementDelayMs : 0;
    const delayTimer = setTimeout(() => {
      const id = ++this.announcementCounter;
      const dismissTimer = setTimeout(() => this.dismissAnnouncement(id), FIGHT_UI.announcementDurationMs);
      this.announcements.push({id, text, dismissTimer});
      this.pendingAnnouncementDelays = this.pendingAnnouncementDelays.filter((it) => it !== delayTimer);
    }, delay);
    this.pendingAnnouncementDelays.push(delayTimer);
  }

  private isAnimalAttackAttacker(attacker: string): boolean {
    if (!attacker) {
      return false;
    }
    if (this.allies.some((ally) => ally.login === attacker) || this.enemies.some((enemy) => enemy.login === attacker)) {
      return false;
    }
    // Boss IDs are numeric strings in PVE and should not be delayed.
    if (/^\d+$/.test(attacker)) {
      return false;
    }
    return true;
  }

  private dismissAnnouncement(id: number) {
    const target = this.announcements.find((it) => it.id === id);
    if (target) {
      clearTimeout(target.dismissTimer);
    }
    this.announcements = this.announcements.filter((it) => it.id !== id);
  }

  private clearAnnouncements() {
    this.pendingAnnouncementDelays.forEach((delayTimer) => clearTimeout(delayTimer));
    this.pendingAnnouncementDelays = [];
    this.announcements.forEach((announcement) => clearTimeout(announcement.dismissTimer));
    this.announcements = [];
  }

  private appendAttackEvent(eventText: string) {
    const time = new Date().toLocaleTimeString();
    this.attackEvents.unshift(`[${time}] ${eventText}`);
    if (this.attackEvents.length > FIGHT_UI.maxAttackEvents) {
      this.attackEvents = this.attackEvents.slice(0, FIGHT_UI.maxAttackEvents);
    }
  }

  private getAnimalStatsKey(tokenOrName: string): string {
    return (tokenOrName ?? '').substring(0, 3).toLowerCase();
  }

  private getAnimalSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${this.getAnimalStatsKey(tokenOrName)}`;
  }

  private getAnimalElementSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${tokenOrName ?? ''}`;
  }

  private buildAnimalTargetToken(tokenOrName: string, ally: boolean): string {
    // Backend PvP animal slots are keyed by canonical side:
    // marker '1' => animals1, marker '0' => animals2.
    // If current user is backend fighter2, enemy animals are in animals1.
    if ((this.type ?? '').toLowerCase() === 'pvp' && !ally) {
      const enemyMarker = this.pvpCurrentUserIsBackendSecond ? '1' : '0';
      return `${this.getAnimalStatsKey(tokenOrName)}${enemyMarker}`;
    }
    return `${this.getAnimalStatsKey(tokenOrName)}${ally ? '1' : '0'}`;
  }

  private resolveAnimalStatsElement(tokenOrName: string, preferAlly?: boolean): HTMLElement | undefined {
    if (preferAlly !== undefined) {
      return this.statsElements[this.getAnimalSideKey(tokenOrName, preferAlly)];
    }
    return this.statsElements[this.getAnimalSideKey(tokenOrName, true)]
      ?? this.statsElements[this.getAnimalSideKey(tokenOrName, false)];
  }

  private findAnimalByToken(list: NinjaAnimal[], tokenOrName: string): NinjaAnimal | undefined {
    const key = this.getAnimalStatsKey(tokenOrName).toLowerCase();
    return list.find((animal) => this.getAnimalStatsKey(animal.name).toLowerCase() === key);
  }

  setPosition(element: HTMLElement, i: number, margin = 0) {
    this.fightRender.setPosition(element, i, margin);
  }

  setHPPercent(stats: HTMLElement, hp?: number) {
    this.fightRender.setHPPercent(stats, hp);
  }

  setChakraPercent(stats: HTMLElement, mp?: number) {
    this.fightRender.setChakraPercent(stats, mp);
  }

  private readNumber(source: any, ...keys: string[]): number | undefined {
    return this.fightDomain.readNumber(source, ...keys);
  }

  private findNumberDeep(
    source: any,
    matcher: (normalizedPath: string) => boolean,
    depth = 0,
    path = ''
  ): number | undefined {
    return this.fightDomain.findNumberDeep(source, matcher, depth, path);
  }

  private toPercent(current?: number, max?: number): number | undefined {
    return this.fightDomain.toPercent(current, max);
  }

  private firstNonNegative(...values: Array<number | undefined>): number | undefined {
    return this.fightDomain.firstNonNegative(...values);
  }

  private firstPositive(...values: Array<number | undefined>): number | undefined {
    return this.fightDomain.firstPositive(...values);
  }

  private userHpPercent(user: any): number | undefined {
    return this.fightDomain.userHpPercent(user, this.userMaxHp, (login) => this.findLocalUserByLogin(login));
  }

  private userChakraPercent(user: any): number | undefined {
    return this.fightDomain.userChakraPercent(user, this.userMaxChakra, (login) => this.findLocalUserByLogin(login));
  }

  private findLocalUserByLogin(login: string | undefined): User | undefined {
    if (!login) {
      return undefined;
    }
    return [...this.allies, ...this.enemies].find((it) => it?.login === login);
  }

  private resolveLocalSummoner(): User | undefined {
    return this.allies.find((ally) => ally?.login === this.sessionStore.username()) ?? this.allies[0];
  }

  private resolveLocalSummonerLevel(): number {
    const localSummoner = this.resolveLocalSummoner();
    return this.readNumber(localSummoner?.stats, 'level')
      ?? this.readNumber(localSummoner, 'level')
      ?? 1;
  }

  getSkillChakraCost(skill: string): number {
    const self = this.resolveLocalSummoner();
    return this.fightDomain.getSkillChakraCost(skill, self);
  }

  isSkillDisabled(skill: string): boolean {
    const self = this.resolveLocalSummoner();
    return this.fightDomain.isSkillDisabled(skill, self);
  }

  private ensureSelectedSpellIsAvailable() {
    if ((this.selectedSpell ?? '').toLowerCase() === FIGHT_CONSTANTS.defaultSkill.toLowerCase()) {
      return;
    }
    if (this.isSkillDisabled(this.selectedSpell)) {
      this.selectedSpell = FIGHT_CONSTANTS.defaultSkill;
    }
  }

  private animalHpPercent(animal: any): number | undefined {
    return this.fightDomain.animalHpPercent(animal);
  }

  private applyAnimalBar(tokenOrName: string, hp?: number, preferAlly?: boolean) {
    if (hp === undefined) {
      const fallbackAnimal = this.resolveAnimalFromToken(tokenOrName, preferAlly);
      hp = this.animalHpPercent(fallbackAnimal);
    }
    if (hp === undefined) {
      this.pushDebug(`Animal bar skipped hp undefined token=${tokenOrName}`);
      return;
    }
    const candidates: Array<HTMLElement | undefined> = [];
    if (preferAlly !== undefined) {
      candidates.push(this.statsElements[this.getAnimalSideKey(tokenOrName, preferAlly)]);
    } else {
      candidates.push(this.statsElements[this.getAnimalSideKey(tokenOrName, true)]);
      candidates.push(this.statsElements[this.getAnimalSideKey(tokenOrName, false)]);
    }
    const animalKey = this.getAnimalStatsKey(tokenOrName);
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
      targets.forEach((stats) => this.setHPPercent(stats, hp));
      this.pushDebug(
        `Animal bar set token=${tokenOrName} side=${preferredSide ?? 'auto'} hp=${Math.round(hp)}% targets=${targets.length}`);
    } else {
      this.pushDebug(`Animal bar target NOT found token=${tokenOrName} side=${preferredSide ?? 'auto'} hp=${Math.round(hp)}%`);
    }
  }

  private pushDebug(message: string) {
    console.debug(`[FightDebug] ${message}`);
    if (!this.showDebugPanel) {
      return;
    }
    const time = new Date().toLocaleTimeString();
    this.debugLines.unshift(`[${time}] ${message}`);
    if (this.debugLines.length > FIGHT_UI.maxDebugLines) {
      this.debugLines = this.debugLines.slice(0, FIGHT_UI.maxDebugLines);
    }
  }

  private resolveAnimalFromToken(tokenOrName: string, preferAlly?: boolean): NinjaAnimal | undefined {
    if (preferAlly === true) {
      return this.findAnimalByToken(this.animals1, tokenOrName);
    }
    if (preferAlly === false) {
      return this.findAnimalByToken(this.animals2, tokenOrName);
    }
    return this.findAnimalByToken(this.animals1, tokenOrName) ?? this.findAnimalByToken(this.animals2, tokenOrName);
  }


  private applyUserBars(login: string, hp?: number, chakra?: number) {
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
        this.setHPPercent(stats, hp);
      }
      if (chakra !== undefined) {
        this.setChakraPercent(stats, chakra);
      }
    });
    this.ensureSelectedSpellIsAvailable();
  }

  private syncLocalFighterFromPayload(participant: any) {
    if (!participant?.login) {
      return;
    }
    const local = [...this.allies, ...this.enemies].find((user) => user?.login === participant.login);
    if (!local?.character) {
      return;
    }
    const payloadCharacter = participant.character ?? {};
    const payloadCurrentHp = this.readNumber(payloadCharacter, 'currentHP', 'currentHp', 'hp');
    const payloadCurrentChakra = this.readNumber(payloadCharacter, 'currentChakra', 'currentchakra', 'chakra');
    if (payloadCurrentHp !== undefined) {
      local.character.currentHP = Math.max(0, payloadCurrentHp);
    }
    if (payloadCurrentChakra !== undefined) {
      local.character.currentChakra = Math.max(0, payloadCurrentChakra);
    }
  }

  setAppearance(element: HTMLElement, user: User) {
    this.fightRender.setAppearance(element, user);
  }

  setUserDead(user: User): void {
    if (user?.login === this.sessionStore.username()) {
      this.localPlayerDead = true;
    }
    if (this.type === 'pvp') {
    } else {
      this.died.push(user.login);
    }
    if (this.statsElements[user.login]) {
      this.statsElements[user.login].style.display = 'none';
    }
    this.fightRender.animateUserDeath(user, this.fightersElements);

  }

  setAnimalDead(animal: NinjaAnimal) {
    const allyAnimal = this.animals1.includes(animal);
    const key = this.getAnimalSideKey(animal?.name, allyAnimal);
    if (this.statsElements[key]) {
      this.statsElements[key].style.display = 'none';
    }
    this.fightRender.animateAnimalDeath(animal, allyAnimal, this.animalsElements);
  }

  finishFight(death: boolean, victory: boolean, loss: boolean, surrendered = false): void {
    if (this.fightEnded) {
      return;
    }
    this.fightEnded = true;
    clearTimeout(this.timer);
    this.clearAnnouncements();
    setTimeout(() => {
      this.endServ.death = death;
      this.endServ.loss = loss;
      this.endServ.victory = victory;
      this.endServ.surrendered = surrendered;
      this.resolveRatingChangeAndShowResult();
    }, FIGHT_UI.finishDelayMs);
  }

  drawAnimal(animal: NinjaAnimal, ally: boolean) {
    const factory = this.resolver.resolveComponentFactory(CharacterComponent);
    let element;
    if (ally) {
      element = this.alliesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      const stats = wrapper.querySelector('.powers') as HTMLElement | null;
      if (stats) {
        stats.dataset.animalKey = this.getAnimalStatsKey(animal.name);
        stats.dataset.animalSide = 'ally';
        this.statsElements[this.getAnimalSideKey(animal.name, true)] = stats;
      }
      const allyIndex = this.animals1.findIndex((it) => it.name === animal.name);
      this.setPosition(wrapper, this.allies.length + Math.max(allyIndex, 0) + 1);
    } else {
      element = this.enemiesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      const stats = wrapper.querySelector('.powers') as HTMLElement | null;
      if (stats) {
        stats.dataset.animalKey = this.getAnimalStatsKey(animal.name);
        stats.dataset.animalSide = 'enemy';
        this.statsElements[this.getAnimalSideKey(animal.name, false)] = stats;
      }
      wrapper.style.position = 'absolute';
      wrapper.style.bottom = '40px';
      const enemyIndex = this.animals2.findIndex((it) => it.name === animal.name);
      wrapper.style.right = (80 + Math.max(enemyIndex, 0) * 80) + 'px';
      wrapper.style.transform = 'scaleX(-1)';
      wrapper.classList.add('enemy-target');
      wrapper.addEventListener('click', () => {
        const token = this.buildAnimalTargetToken(animal.name, false);
        this.pushDebug(`Attack request enemy animal ${animal.name} token=${token}`);
        this.attack(token);
      });
    }

    this.animalsElements[this.getAnimalElementSideKey(animal.name, ally)] = <HTMLElement>element.location.nativeElement;
    this.updateTargetCursor();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.clearAnnouncements();
  }

}
