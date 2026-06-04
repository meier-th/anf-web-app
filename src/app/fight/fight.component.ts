import {
  AfterContentInit,
  Component,
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef, ElementRef, Injector, OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {FightService} from '../services/fight/fight.service';
import {FightEndService} from '../services/fight-end.service';
import {User} from '../classes/user';
import {FightResultComponent} from '../fight-result/fight-result.component';
import {Boss} from '../classes/boss';
import {CharacterComponent} from '../character/character.component';
import {HttpClient, HttpParams} from '@angular/common/http';
import {MainComponent} from '../main/main.component';
import {ConfirmationService, MessageService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Character} from '../classes/character';
import {animate, state, style, transition, trigger} from '@angular/animations';
import SockJS from 'sockjs-client';
import {Stomp} from '@stomp/stompjs';
import {Router} from '@angular/router';
import {TranslateService} from '../services/translate.service';
import {TranslatePipe} from '../services/translate.pipe';
import {NinjaAnimal} from '../classes/ninja-animal';
import {ApiConfigService} from '../core/config/api-config.service';

type AttackAnnouncement = {
  id: number;
  text: string;
  dismissTimer: ReturnType<typeof setTimeout>;
};

@Component({
  selector: 'app-fight',
  standalone: false,
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
  ]
})
export class FightComponent implements OnInit, OnDestroy {
  allies: User[] = [];
  enemies: User[] = [];
  private dialog: DynamicDialogRef;
  boss: Boss;
  died: string[] = [];
  animals1: NinjaAnimal[] = [];
  animals2: NinjaAnimal[] = [];
  @ViewChild('alliesContainer', {read: ViewContainerRef}) alliesContainer;
  @ViewChild('enemiesContainer', {read: ViewContainerRef}) enemiesContainer;
  fightersElements: { [key: string]: HTMLElement } = {};
  statsElements: { [key: string]: HTMLElement } = {};
  skills: string[] = [];
  parent = this.injector.get(MainComponent);
  loaded = false;
  type: string;
  private stompClient;
  id: string;
  selectedSpell = 'Physical attack';
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

  constructor(private router: Router, private transl: TranslatePipe,
              private dialogService: DialogService,
              private confirmationService: ConfirmationService, private fightService: FightService,
              private resolver: ComponentFactoryResolver, private http: HttpClient,
              private injector: Injector, private endServ: FightEndService, private apiConfig: ApiConfigService) {
  }

  ngOnInit() {
    if (!this.fightService.valuesSet) {
      const segments = this.parent.router.url.split('/').filter((segment) => segment.length > 0);
      this.type = segments[1] ?? '';
      this.id = segments[2] ?? '';
    } else {
      this.id = this.fightService.id;
      this.type = this.fightService.type;
    }
    this.initializeWebSockets();
    this.getFightInfo(this.type);
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
          that.scheduleAttackAnnouncement(fightState);
          that.appendAttackEvent(
            `${fightState.attacker} -> ${fightState.target}: ${fightState.damage} (${fightState.attackName})`);
          that.setTimer(fightState.nextAttacker, 30200);
          console.log(fightState);

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
            targetAnimal.currentHP -= fightState.damage;
            if (targetAnimal.currentHP < 0) {
              targetAnimal.currentHP = 0;
            }
            const targetStats = that.resolveAnimalStatsElement(fightState.target, that.animals1.includes(targetAnimal));
            if (targetStats) {
              that.setHPPercent(targetStats, that.animalHpPercent(targetAnimal));
            }
          }

          // set chakra for attacker
          if (userIsAttacker && attackerUser) {
            attackerUser.character.currentChakra -= fightState.chakraCost;
            that.applyUserBars(fightState.attacker, undefined, that.userChakraPercent(attackerUser));
          }

          // if deadly
          if (fightState.deadly) {
            console.log('deadly');
            if (userIsTarget) {
              console.log('target');
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
          that.scheduleAttackAnnouncement(fightState);
          that.appendAttackEvent(
            `${fightState.attacker} -> ${fightState.target}: ${fightState.damage} (${fightState.attackName})`);
          that.setTimer(fightState.nextAttacker, 30200);
          console.log(fightState);

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
              console.log(fightState.target);
              console.log(targetAnimal);
              try {
                targetAnimal.currentHP -= fightState.damage;
                if (targetAnimal.currentHP < 0) {
                  targetAnimal.currentHP = 0;
                }
                const targetStats = that.resolveAnimalStatsElement(fightState.target, that.animals1.includes(targetAnimal));
                if (targetStats) {
                  that.setHPPercent(targetStats, that.animalHpPercent(targetAnimal));
                }
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
              if (that.died.includes(that.parent.login)) {
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
        that.setTimer(response.body, 30000);
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
    console.log(this.allies);
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
      console.log(element);
      this.setPosition(element, i);
      hidden.style.display = 'none';
      console.log(hidden);
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
      console.log(element);
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
      (<HTMLElement>boss.location.nativeElement).addEventListener('click', () => {
        this.attack(boss.instance.bossId);
      });
      (<HTMLElement>boss.location.nativeElement).classList.add('enemy-target');

    }
    this.updateTargetCursor();
  }

  getFightInfo(type: string) {
    if (type.toLowerCase() === 'pvp') {
      this.http.post(this.apiConfig.buildUrl('/fight/info'), null, {
        withCredentials: true,
        params: new HttpParams().append('fightUuid', this.id)
      }).subscribe((data: {
        id: number, type: string,
        fighters1: User, fighters2: User,
        animals1: NinjaAnimal[], animals2: NinjaAnimal[],
        currentName: string, timeLeft: number
      }) => {
        this.setTimer(data.currentName, data.timeLeft);
        if (data.fighters2.login === this.parent.login) {
          const tmp = data.fighters1;
          data.fighters1 = data.fighters2;
          data.fighters2 = tmp;
          const tmpAnimals = data.animals1;
          data.animals1 = data.animals2;
          data.animals2 = tmpAnimals;
        }
        this.allies = [data.fighters1];
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
        console.log(data);
        const spells = data.fighters1.character.spellsKnown;
        this.skills.push('Physical attack');
        this.map['Physical attack'] = 'Physical attack\n' +
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
      this.http.post(this.apiConfig.buildUrl('/fight/info'), null, {
        withCredentials: true,
        params: new HttpParams().append('fightUuid', this.id)
      }).subscribe((data: {
        id: number, type: string, fighters1: User[], currentName: string, timeLeft: number,
        boss: Boss, animals1: NinjaAnimal[]
      }) => {
        this.setTimer(data.currentName, data.timeLeft);
        this.allies = data.fighters1;
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
        const spells = data.fighters1.find(us => us.login === this.parent.login).character.spellsKnown;
        this.skills.push('Physical attack');
        this.map['Physical attack'] = 'Physical attack\n' +
          this.transl.transform('Damage') + ': ' +
          data.fighters1.find(us => us.login === this.parent.login)
            .character.physicalDamage + '\n' + this.transl.transform('Chakra') + ': 0';
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
          if (data.animals1[i].summoner === this.parent.login) {
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
    if (currentName === this.parent.login) {
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
      timerElement.innerText = Math.max(0, Math.ceil(timeLeft / 1000)).toString();
    }
    this.timer = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1000);
      if (timerElement) {
        timerElement.innerText = Math.max(0, Math.ceil(timeLeft / 1000)).toString();
      }
      if (timeLeft === 0 && this.current && !this.timeoutReported) {
        this.timeoutReported = true;
        this.reportTurnTimeout();
      }
    }, 1000);
  }

  private reportTurnTimeout() {
    this.http.post(this.apiConfig.buildUrl('/fight/timeout'), null, {
      withCredentials: true,
      params: new HttpParams()
        .append('fightUuid', this.id)
        .append('timedOutAttacker', this.current)
    }).subscribe({
      error: () => {
        this.timeoutReported = false;
      }
    });
  }

  attack(enemy: string): any {
    if (this.current !== this.parent.login) {
      return;
    }
    const self: User = this.allies.find(all => all.login === this.parent.login);
    if (this.selectedSpell === 'Air Strike' &&
      self.character.currentChakra <
      (70 + 10 * self.character.spellsKnown
        .find(sh => sh.spellUse.name === 'Air Strike').spellLevel) ||
      this.selectedSpell === 'Fire Strike' &&
      self.character.currentChakra <
      (40 + 5 * self.character.spellsKnown
        .find(sh => sh.spellUse.name === 'Fire Strike').spellLevel) ||
      this.selectedSpell === 'Water Strike' &&
      self.character.currentChakra <
      (20 + 4 * self.character.spellsKnown
        .find(sh => sh.spellUse.name === 'Water Strike').spellLevel) ||
      this.selectedSpell === 'Earth Strike' &&
      self.character.currentChakra <
      (12 + 3 * self.character.spellsKnown
        .find(sh => sh.spellUse.name === 'Earth Strike').spellLevel)) {
      this.selectedSpell = 'Physical attack';
    }
    this.http.post(this.apiConfig.buildUrl('/fight/attack'), null, {
      withCredentials: true,
      params: new HttpParams()
        .append('fightUuid', this.id)
        .append('enemy', enemy)
        .append('spellName', this.selectedSpell)
    }).subscribe((data: {
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
    this.http.post(this.apiConfig.buildUrl('/fight/info'), null, {
      withCredentials: true,
      params: new HttpParams().append('fightUuid', this.id)
    }).subscribe((data: any) => {
      if ((this.type ?? '').toLowerCase() === 'pvp') {
        const side1 = data.fighters1;
        const side2 = data.fighters2;
        [side1, side2].forEach((participant) => {
          if (participant?.login) {
            this.applyUserBars(participant.login, this.userHpPercent(participant), this.userChakraPercent(participant));
          }
        });

        const localAllyLogin = this.allies[0]?.login;
        const side1IsAlly = !!localAllyLogin && side1?.login === localAllyLogin;
        const side2IsAlly = !!localAllyLogin && side2?.login === localAllyLogin;

        (data.animals1 ?? []).forEach((animal) => {
          const key = this.getAnimalSideKey(animal.name, side1IsAlly);
          if (this.statsElements[key]) {
            this.setHPPercent(this.statsElements[key], this.animalHpPercent(animal));
          }
        });
        (data.animals2 ?? []).forEach((animal) => {
          const key = this.getAnimalSideKey(animal.name, side2IsAlly);
          if (this.statsElements[key]) {
            this.setHPPercent(this.statsElements[key], this.animalHpPercent(animal));
          }
        });
      } else {
        const self = (data.fighters1 ?? []).find((it) => it.login === this.parent.login);
        if (self?.login) {
          this.applyUserBars(self.login, this.userHpPercent(self), this.userChakraPercent(self));
        }
        if (data.boss && this.statsElements[data.boss.numberOfTails]) {
          this.setHPPercent(this.statsElements[data.boss.numberOfTails], data.boss.currentHP / data.boss.maxHp * 100);
        }
        (data.animals1 ?? []).forEach((animal) => {
          const key = this.getAnimalSideKey(animal.name, true);
          if (this.statsElements[key]) {
            this.setHPPercent(this.statsElements[key], this.animalHpPercent(animal));
          }
        });
      }
    });
  }

  summon() {
    this.http.post(this.apiConfig.buildUrl('/fight/summon' +
      this.type.substring(0, 1).toUpperCase() +
      this.type.substring(1).toLowerCase()), null, {
      withCredentials: true,
      params: new HttpParams().append('fightUuid', this.id)
    }).subscribe((response: NinjaAnimal) => {
      console.log(response);
      this.summonEnabled = false;
    });
  }

  selectSpell(event: MouseEvent) {
    if (this.current === this.parent.login) {
      const selectedSpell = (event.target as HTMLElement | null)?.id ?? 'Physical attack';
      const self: User = this.allies.find(all => all.login === this.parent.login);
      if (selectedSpell === 'Air Strike' &&
        self.character.currentChakra <
        (70 + 10 * self.character.spellsKnown
          .find(sh => sh.spellUse.name === 'Air Strike').spellLevel) ||
        selectedSpell === 'Fire Strike' &&
        self.character.currentChakra <
        (40 + 5 * self.character.spellsKnown
          .find(sh => sh.spellUse.name === 'Fire Strike').spellLevel) ||
        selectedSpell === 'Water Strike' &&
        self.character.currentChakra <
        (20 + 4 * self.character.spellsKnown
          .find(sh => sh.spellUse.name === 'Water Strike').spellLevel) ||
        selectedSpell === 'Earth Strike' &&
        self.character.currentChakra <
        (12 + 3 * self.character.spellsKnown
          .find(sh => sh.spellUse.name === 'Earth Strike').spellLevel)) {
        alert(this.transl.transform('Not enough chakra'));
        this.selectedSpell = 'Physical attack';
      } else {
        this.selectedSpell = selectedSpell;
      }
      this.updateTargetCursor();
    } else {
      alert(this.transl.transform('Not your turn!'));
    }

  }

  private updateTargetCursor() {
    const cursor = this.current === this.parent.login ? 'crosshair' : 'default';
    const targets = document.querySelectorAll('.enemy-target');
    targets.forEach((target) => {
      (target as HTMLElement).style.cursor = cursor;
    });
  }

  private scheduleAttackAnnouncement(fightState: {
    attacker: string;
    target: string;
    attackName: string;
    damage: number;
  }) {
    const text = `${fightState.attacker} attacked ${fightState.target} for ${fightState.damage} (${fightState.attackName})`;
    const delay = this.isAnimalAttackAttacker(fightState.attacker) ? 500 : 0;
    const delayTimer = setTimeout(() => {
      const id = ++this.announcementCounter;
      const dismissTimer = setTimeout(() => this.dismissAnnouncement(id), 2000);
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
    if (this.attackEvents.length > 8) {
      this.attackEvents = this.attackEvents.slice(0, 8);
    }
  }

  private getAnimalStatsKey(tokenOrName: string): string {
    return (tokenOrName ?? '').substring(0, 3);
  }

  private getAnimalSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${this.getAnimalStatsKey(tokenOrName)}`;
  }

  private getAnimalElementSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${tokenOrName ?? ''}`;
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
    element.style.position = 'absolute';
    element.style.bottom = (margin + 40 * ((i + 1) % 2)) + 'px';
    element.style.left = (80 * Math.round(i / 2) + 40 * ((i + 1) % 2)) + 'px';
  }

  setHPPercent(stats: HTMLElement, hp?: number) {
    if (!Number.isFinite(hp)) {
      return;
    }
    const hpEl = <HTMLElement>stats.getElementsByClassName('hp')[0];
    if (!hpEl) {
      return;
    }
    hpEl.style.width = hp + '%';
  }

  setChakraPercent(stats: HTMLElement, mp?: number) {
    if (!Number.isFinite(mp)) {
      return;
    }
    const mpEl = <HTMLElement>stats.getElementsByClassName('mp')[0];
    if (!mpEl) {
      return;
    }
    mpEl.style.width = mp + '%';
  }

  private readNumber(source: any, ...keys: string[]): number | undefined {
    if (!source) {
      return undefined;
    }
    const normalize = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const parseNumeric = (value: any): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return undefined;
    };
    for (const key of keys) {
      const direct = parseNumeric(source[key]);
      if (direct !== undefined) {
        return direct;
      }
      const normalizedKey = normalize(key);
      for (const [entryKey, entryValue] of Object.entries(source)) {
        if (normalize(entryKey) === normalizedKey) {
          const loose = parseNumeric(entryValue);
          if (loose !== undefined) {
            return loose;
          }
        }
      }
    }
    return undefined;
  }

  private findNumberDeep(
    source: any,
    matcher: (normalizedPath: string) => boolean,
    depth = 0,
    path = ''
  ): number | undefined {
    if (source == null || depth > 3) {
      return undefined;
    }
    if (typeof source === 'number' && Number.isFinite(source)) {
      const normalizedPath = path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return matcher(normalizedPath) ? source : undefined;
    }
    if (typeof source === 'string') {
      const parsed = Number(source);
      if (Number.isFinite(parsed)) {
        const normalizedPath = path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return matcher(normalizedPath) ? parsed : undefined;
      }
      return undefined;
    }
    if (typeof source !== 'object') {
      return undefined;
    }
    for (const [key, value] of Object.entries(source)) {
      const nestedPath = path ? `${path}.${key}` : key;
      const nested = this.findNumberDeep(value, matcher, depth + 1, nestedPath);
      if (nested !== undefined) {
        return nested;
      }
    }
    return undefined;
  }

  private toPercent(current?: number, max?: number): number | undefined {
    if (current === undefined || max === undefined || max <= 0) {
      return undefined;
    }
    return Math.max(0, Math.min(100, current / max * 100));
  }

  private firstNonNegative(...values: Array<number | undefined>): number | undefined {
    for (const value of values) {
      if (value !== undefined && value >= 0) {
        return value;
      }
    }
    return undefined;
  }

  private firstPositive(...values: Array<number | undefined>): number | undefined {
    for (const value of values) {
      if (value !== undefined && value > 0) {
        return value;
      }
    }
    return undefined;
  }

  private userHpPercent(user: any): number | undefined {
    const login = user?.login;
    const source = user?.character ?? user?.gameCharacter ?? user;
    const current = this.firstNonNegative(
      this.readNumber(source, 'currentHP', 'currentHp', 'currentHpAmount', 'hp'),
      this.findNumberDeep(source, (path) => path.includes('current') && (path.includes('hp') || path.includes('health'))),
      this.readNumber(this.findLocalUserByLogin(login)?.character, 'currentHP', 'currentHp', 'hp')
    );
    const max = this.firstPositive(
      this.readNumber(source, 'maxHp', 'maxHP', 'maxHpAmount', 'maxHPAmount', 'hpAmount'),
      this.findNumberDeep(source, (path) => path.includes('max') && (path.includes('hp') || path.includes('health'))),
      this.userMaxHp[login],
      this.readNumber(this.findLocalUserByLogin(login)?.character, 'maxHp', 'maxHP', 'hpAmount')
    );
    if (login && current !== undefined) {
      const observed = this.userMaxHp[login];
      if (observed === undefined || current > observed) {
        this.userMaxHp[login] = current;
      }
    }
    const effectiveMax = this.firstPositive(max, this.userMaxHp[login], current);
    const percent = this.toPercent(
      current,
      effectiveMax);
    if (login && effectiveMax !== undefined && effectiveMax > 0) {
      this.userMaxHp[login] = effectiveMax;
    }
    return percent;
  }

  private userChakraPercent(user: any): number | undefined {
    const login = user?.login;
    const source = user?.character ?? user?.gameCharacter ?? user;
    const current = this.firstNonNegative(
      this.readNumber(source, 'currentChakra', 'currentchakra', 'currentChakraAmount', 'chakra'),
      this.findNumberDeep(source, (path) => path.includes('current') && path.includes('chakra')),
      this.readNumber(this.findLocalUserByLogin(login)?.character, 'currentChakra', 'currentchakra', 'chakra')
    );
    const max = this.firstPositive(
      this.readNumber(source, 'maxChakra', 'maxchakra', 'maxChakraAmount', 'chakraAmount'),
      this.findNumberDeep(source, (path) => path.includes('max') && path.includes('chakra')),
      this.userMaxChakra[login],
      this.readNumber(this.findLocalUserByLogin(login)?.character, 'maxChakra', 'maxchakra', 'chakraAmount')
    );
    if (login && current !== undefined) {
      const observed = this.userMaxChakra[login];
      if (observed === undefined || current > observed) {
        this.userMaxChakra[login] = current;
      }
    }
    const effectiveMax = this.firstPositive(max, this.userMaxChakra[login], current);
    const percent = this.toPercent(
      current,
      effectiveMax);
    if (login && effectiveMax !== undefined && effectiveMax > 0) {
      this.userMaxChakra[login] = effectiveMax;
    }
    return percent;
  }

  private findLocalUserByLogin(login: string | undefined): User | undefined {
    if (!login) {
      return undefined;
    }
    return [...this.allies, ...this.enemies].find((it) => it?.login === login);
  }

  private animalHpPercent(animal: any): number | undefined {
    return this.toPercent(
      this.readNumber(animal, 'currentHP', 'currentHp'),
      this.readNumber(animal, 'maxHP', 'maxHp'));
  }

  private applyUserBars(login: string, hp?: number, chakra?: number) {
    const allStats = Array.from(document.querySelectorAll('.powers')) as HTMLElement[];
    const matchedByLogin = allStats.filter((stats) => (stats.dataset?.login ?? '').trim() === (login ?? '').trim());
    const matchedByLabel = allStats.filter((stats) => {
      const nameEl = stats.getElementsByClassName('name')[0] as HTMLElement | undefined;
      return (nameEl?.innerText ?? '').trim() === (login ?? '').trim();
    });
    const candidates = [...new Set<HTMLElement>([
      ...matchedByLogin,
      ...matchedByLabel,
      this.statsElements[login]
    ].filter(Boolean))];

    candidates.forEach((stats) => {
      if (hp !== undefined) {
        this.setHPPercent(stats, hp);
      }
      if (chakra !== undefined) {
        this.setChakraPercent(stats, chakra);
      }
    });
  }

  setAppearance(element: HTMLElement, user: User) {
    const hair = element.getElementsByClassName('hair');
    for (let i = 0; i < hair.length; i++) {
      (<HTMLElement>hair[i]).style.fill = this.chooseHair(user);
      (<HTMLElement>hair[i]).style.stroke = this.chooseHair(user);
    }
    const skin = element.getElementsByClassName('skin');
    for (let i = 0; i < skin.length; i++) {
      (<HTMLElement>skin[i]).style.fill = this.chooseSkin(user);
      (<HTMLElement>skin[i]).style.stroke = this.chooseSkin(user);
    }
    const clothes = element.getElementsByClassName('clothes');
    for (let i = 0; i < clothes.length; i++) {
      (<HTMLElement>clothes[i]).style.fill = this.chooseClothes(user);
      (<HTMLElement>clothes[i]).style.stroke = this.chooseClothes(user);
    }

  }

  chooseHair(user: User): string {
    switch (user.character.appearance.hairColour) {
      case 'YELLOW':
        return '#DEAB7F';
      case 'BROWN':
        return '#A53900';
      case 'BLACK':
        return '#2D221C';
    }
  }

  chooseSkin(user: User): string {
    switch (user.character.appearance.skinColour) {
      case 'BLACK':
        return '#6E2B12';
      case 'WHITE':
        return '#EBCCAB';
      case 'LATIN':
        return '#C37C4D';
      case 'DARK':
        return '#934C1D';
    }
  }

  chooseClothes(user: User): string {
    switch (user.character.appearance.clothesColour) {
      case 'RED':
        return 'crimson';
      case 'GREEN':
        return '#81E890';
      case 'BLUE':
        return 'cornflowerblue';
    }
  }

  setUserDead(user: User): void {
    if (this.type === 'pvp') {
      console.log(user.login + ' has perished.');
    } else {
      this.died.push(user.login);
    }
    if (this.statsElements[user.login]) {
      this.statsElements[user.login].style.display = 'none';
    }
    let counter = 0;
    let translate: string;
    const anim = setInterval(() => {
      counter++;
      this.fightersElements[user.login].style.transform = 'rotate(-' + counter + 'deg)';
      if (counter < 27) {
        translate = 'translate(0,-' + (counter) * 2 + 'px)';
        this.fightersElements[user.login].style.transform += translate;
      } else {
        this.fightersElements[user.login].style.transform += translate;
      }
      if (counter === 87) {
        clearInterval(anim);
      }
    }, 3);

  }

  setAnimalDead(animal: NinjaAnimal) {
    console.log('dead');
    const allyAnimal = this.animals1.includes(animal);
    const key = this.getAnimalSideKey(animal?.name, allyAnimal);
    if (this.statsElements[key]) {
      this.statsElements[key].style.display = 'none';
    }
    let counter = 0;
    let translate: string;
    const animalElementKey = this.getAnimalElementSideKey(animal.name, allyAnimal);
    const anim = setInterval(() => {
      counter++;
      this.animalsElements[animalElementKey].style.transform = 'rotate(-' + counter + 'deg)';
      if (counter < 27) {
        translate = 'translate(0,-' + (counter) * 2 + 'px)';
        this.animalsElements[animalElementKey].style.transform += translate;
      } else {
        this.animalsElements[animalElementKey].style.transform += translate;
      }
      if (counter === 87) {
        clearInterval(anim);
      }
    }, 3);
  }

  finishFight(death: boolean, victory: boolean, loss: boolean): void {
    clearTimeout(this.timer);
    this.clearAnnouncements();
    setTimeout(() => {
      this.endServ.death = death;
      this.endServ.loss = loss;
      this.endServ.victory = victory;
      this.dialog = this.dialogService.open(FightResultComponent, {
        width: '400px', height: '160px'
      });
      this.router.navigateByUrl('/main');
    }, 1000);
  }

  drawAnimal(animal: NinjaAnimal, ally: boolean) {
    const factory = this.resolver.resolveComponentFactory(CharacterComponent);
    let element;
    if (ally) {
      element = this.alliesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      this.statsElements[this.getAnimalSideKey(animal.name, true)] = <HTMLElement>wrapper.childNodes[0];
      const allyIndex = this.animals1.findIndex((it) => it.name === animal.name);
      this.setPosition(wrapper, this.allies.length + Math.max(allyIndex, 0) + 1);
    } else {
      element = this.enemiesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      const wrapper = <HTMLElement>element.location.nativeElement;
      this.statsElements[this.getAnimalSideKey(animal.name, false)] = <HTMLElement>wrapper.childNodes[0];
      wrapper.style.position = 'absolute';
      wrapper.style.bottom = '40px';
      const enemyIndex = this.animals2.findIndex((it) => it.name === animal.name);
      wrapper.style.right = (80 + Math.max(enemyIndex, 0) * 80) + 'px';
      wrapper.style.transform = 'scaleX(-1)';
      wrapper.classList.add('enemy-target');
      wrapper.addEventListener('click', () => {
        this.attack(animal.name);
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
