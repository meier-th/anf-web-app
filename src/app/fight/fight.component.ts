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

@Component({
  selector: 'app-fight',
  standalone: false,
  templateUrl: './fight.component.html',
  styleUrls: ['./fight.component.less'],
  animations: [
    trigger('attack', [
      state('default', style({
        opacity: 0
      })),
      state('use', style({
        opacity: 0.8
      })),
      transition('default => use', animate('0.3s')),
      transition('use => default', animate('0.3s'))
    ]),
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
  id: number;
  selectedSpell = 'Physical attack';
  map: { [key: string]: string } = {};
  used = 'physical';
  timer: ReturnType<typeof setInterval>;
  current: string;
  kek = false;
  summonEnabled = true;
  animalsElements: { [key: string]: HTMLElement } = {};

  constructor(private router: Router, private transl: TranslatePipe,
              private dialogService: DialogService,
              private confirmationService: ConfirmationService, private fightService: FightService,
              private resolver: ComponentFactoryResolver, private http: HttpClient,
              private injector: Injector, private endServ: FightEndService) {
  }

  ngOnInit() {
    if (!this.fightService.valuesSet) {
      const url = this.parent.router.url;
      this.id = Number.parseInt(url.substring(11), 10);
      this.type = url.substring(7, 10);
    } else {
      this.id = this.fightService.id;
      this.type = this.fightService.type;
    }
    this.initializeWebSockets();
    this.getFightInfo(this.type);
  }

  initializeWebSockets() {
    const ws = new SockJS('http://localhost:8080/socket');
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
          that.used = fightState.attackName.substring(0, fightState.attackName.indexOf(' ')).toLowerCase();
          that.kek = true;
          setTimeout(() => {
            that.kek = false;
          }, 800);
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
            if (that.animals1.map(anim => anim.name).includes(fightState.target)) {
              targetAnimal = that.animals1.find(anim => anim.name.substring(0, 3) === fightState.target.substring(0, 3));
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
              targetAnimal = that.animals2.find(anim => anim.name === fightState.target);
              userIsTarget = false;
            }
          } else if (that.animals1.map(anim => anim.name).includes(fightState.attacker)) {
            attackerAnimal = that.animals1.find(anim => anim.name === fightState.attacker);
            userIsAttacker = false;
            yourSideAttacks = true;
            // enemy user is a target
            if (that.enemies.map(enemy => enemy.login).includes(fightState.target)) {
              targetUser = that.enemies.find(us => us.login === fightState.target);
              userIsTarget = true;
            } else {
              targetAnimal = that.animals2.find(anim => anim.name === fightState.target);
              userIsTarget = false;
            }
          } else {
            attackerAnimal = that.animals2.find(anim => anim.name === fightState.attacker);
            userIsAttacker = false;
            yourSideAttacks = false;
            // your user is a target
            if (that.allies.map(ally => ally.login).includes(fightState.target)) {
              targetUser = that.allies.find(ally => ally.login === fightState.target);
              userIsTarget = true;
            } else {
              targetAnimal = that.animals1.find(anim => anim.name === fightState.target);
              userIsTarget = false;
            }
          }

          // set hp and chakra for target
          if (userIsTarget) {
            targetUser.character.currentHP -= fightState.damage;
            if (targetUser.character.currentHP < 0) {
              targetUser.character.currentHP = 0;
            }
            targetUser.character.currentChakra -= fightState.chakraBurn;
            that.setHPPercent(that.statsElements[fightState.target],
              targetUser.character.currentHP / targetUser.character.maxHp * 100);
            that.setChakraPercent(that.statsElements[fightState.target],
              targetUser.character.currentChakra / targetUser.character.maxChakra * 100);
          } else {
            targetAnimal.currentHP -= fightState.damage;
            if (targetAnimal.currentHP < 0) {
              targetAnimal.currentHP = 0;
            }
            that.setHPPercent(that.statsElements[fightState.target],
              targetAnimal.currentHP / targetAnimal.maxHP * 100);
          }

          // set chakra for attacker
          if (userIsAttacker) {
            attackerUser.character.currentChakra -= fightState.chakraCost;
            that.setChakraPercent(that.statsElements[fightState.attacker],
              attackerUser.character.currentChakra / attackerUser.character.maxChakra * 100);
          }

          // if deadly
          if (fightState.deadly) {
            console.log('deadly');
            if (userIsTarget) {
              console.log('target');
              that.setUserDead(targetUser); // method for graphics
            } else {
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
          that.used = fightState.attackName.substring(0, fightState.attackName.indexOf(' ')).toLowerCase();
          that.kek = true;
          setTimeout(() => {
            that.kek = false;
          }, 800);
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
          animalIsAttacker = fightState.attacker.length === 3 || fightState.attacker.length === 3;
          userIsAttacker = fightState.attacker.length >= 6;
          if (userIsAttacker) {
            attackerUser = that.allies.find(all => all.login === fightState.attacker);
            bossIsAttacker = false;
            userIsAttacker = true;
            animalIsAttacker = false;
            bossIsTarget = true;
            userIsTarget = false;
            animalIsTarget = false;
          } else if (animalIsAttacker) {
            attackerAnimal = that.animals1.find(anim =>
              anim.name.substring(0, 3).toLowerCase() === fightState.attacker.substring(0, 3).toLowerCase());
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
              targetAnimal = that.animals1.find(anim =>
                anim.name.substring(0, 3).toLowerCase() === fightState.target.substring(0, 3).toLowerCase());
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
            that.setHPPercent(that.statsElements[fightState.target],
              that.boss.currentHP / that.boss.maxHp * 100);
            if (userIsAttacker) {
              that.setChakraPercent(that.statsElements[fightState.attacker],
                attackerUser.character.currentHP / attackerUser.character.maxHp * 100);
            } else {
              // that.setChakraPercent(that.statsElements[fightState.attacker],
              //   attackerAnimal.currentHP / attackerAnimal.maxHP * 100);
            }
          } else {
            if (userIsTarget) {
              targetUser.character.currentHP -= fightState.damage;
              if (targetUser.character.currentHP < 0) {
                targetUser.character.currentHP = 0;
              }
              that.setHPPercent(that.statsElements[fightState.target],
                targetUser.character.currentHP / targetUser.character.maxHp * 100);
            } else {
              console.log(fightState.target);
              console.log(targetAnimal);
              try {
                targetAnimal.currentHP -= fightState.damage;
                if (targetAnimal.currentHP < 0) {
                  targetAnimal.currentHP = 0;
                }
                that.setHPPercent(that.statsElements[fightState.target],
                  targetAnimal.currentHP / targetAnimal.maxHP * 100);
              } catch (e) {

              }
            }
          }

          // check if deadly
          if (fightState.deadly) {
            // if boss killed someone
            if (bossIsAttacker) {
              if (animalIsTarget) {
                that.setAnimalDead(targetAnimal);
              } else {
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
          that.animals1.push(animal);
          that.drawAnimal(animal, true);
        } else {
          that.animals2.push(animal);
          that.drawAnimal(animal, false);
        }
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
      const element = (<HTMLElement>(<HTMLElement>character.location.nativeElement).childNodes[1 + genderId]);
      this.fightersElements[this.allies[this.allies.length - i - 1].login] = element;
      element.style.display = 'block';
      console.log(element);
      this.setPosition(element, i);
      (<HTMLElement>(<HTMLElement>character.location.nativeElement)
        .childNodes[1 + (genderId + 1) % 2]).style.display = 'none';
      console.log((<HTMLElement>(<HTMLElement>character.location.nativeElement)
        .childNodes[1 + (genderId + 1) % 2]));
      const stats = (<HTMLElement>(<HTMLElement>character.location.nativeElement).childNodes[0]);
      this.statsElements[this.allies[this.allies.length - i - 1].login] = stats;
      this.setPosition(stats, i, 125);

      (<HTMLElement>stats
        .getElementsByClassName('name')[0])
        .innerText = this.allies[this.allies.length - i - 1].login;
      this.setHPPercent(stats, 100);
      this.setChakraPercent(stats, 100);
      this.setAppearance(element, this.allies[this.allies.length - i - 1]);
    }
    if (this.type === 'pvp') {
      character = this.enemiesContainer.createComponent(factory);
      const genderId = this.enemies[0].character.appearance.gender === 'FEMALE' ? 1 : 0;
      const element = (<HTMLElement>(<HTMLElement>character.location.nativeElement).childNodes[1 + genderId]);
      this.fightersElements[this.enemies[0].login] = element;
      element.style.display = 'block';
      element.classList.add('enemy');
      (<HTMLElement>(<HTMLElement>character.location.nativeElement)
        .childNodes[1 + (genderId + 1) % 2]).style.display = 'none';
      console.log(element);
      this.setAppearance(element, this.enemies[0]);
      const stats = (<HTMLElement>(<HTMLElement>character.location.nativeElement).childNodes[0]);
      this.statsElements[this.enemies[0].login] = stats;
      this.setHPPercent(stats,
        this.enemies[0].character.currentHP / this.enemies[0].character.maxHp * 100);
      this.setChakraPercent(stats,
        this.enemies[0].character.currentChakra / this.enemies[0].character.maxChakra * 100);
      const login = this.enemies[0].login;
      (<HTMLElement>stats
        .getElementsByClassName('name')[0])
        .innerText = login;
      element.addEventListener('click', () => {
        this.attack(login);
      });
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

    }
  }

  getFightInfo(type: string) {
    if (type.toLowerCase() === 'pvp') {
      this.http.post('http://localhost:8080/fight/info', null, {
        withCredentials: true,
        params: new HttpParams().append('id', this.id.toString())
      }).subscribe((data: {
        id: number, type: string,
        fighters1: User, fighters2: User,
        animals1: NinjaAnimal, animals2: NinjaAnimal,
        currentName: string, timeLeft: number
      }) => {
        this.setTimer(data.currentName, data.timeLeft);
        if (data.fighters2.login === this.parent.login) {
          const tmp = data.fighters1;
          data.fighters1 = data.fighters2;
          data.fighters2 = tmp;
        }
        this.allies = [data.fighters1];
        this.summonEnabled = this.summonEnabled && this.allies[0].character.animalRace != null;
        this.enemies = [data.fighters2];
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
      });
      if (this.animals1.length > 0) {
        this.summonEnabled = false;
      }
    } else {
      this.http.post('http://localhost:8080/fight/info', null, {
        withCredentials: true,
        params: new HttpParams().append('id', this.id.toString())
      }).subscribe((data: {
        id: number, type: string, fighters1: User[], currentName: string, timeLeft: number,
        boss: Boss, animals1: NinjaAnimal[]
      }) => {
        this.setTimer(data.currentName, data.timeLeft);
        this.allies = data.fighters1;
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
    this.current = currentName;
    if (currentName === this.parent.login) {
      currentName = this.transl.transform('Your turn!');
    } else {
      if (currentName === '') {
        currentName = this.transl.transform('Prepare!');
      } else {
        currentName = currentName + '\'s ' + this.transl.transform('turn!');
      }
    }
    document.getElementById('current').innerText = currentName;
    this.timer = setInterval(() => {
      timeLeft -= 1000;
      document.getElementById('timer').innerText = (timeLeft / 1000).toFixed(0);
    }, 1000);
  }

  attack(enemy: string): any {
    if (this.current !== this.parent.login) {
      return;
    }
    this.kek = true;
    this.used = this.selectedSpell.substring(0, this.selectedSpell.indexOf(' ')).toLowerCase();
    setTimeout(() => {
      this.kek = false;
    }, 800);
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
    this.http.post('http://localhost:8080/fight/attack', null, {
      withCredentials: true,
      params: new HttpParams()
        .append('fightId', this.id.toString())
        .append('enemy', enemy)
        .append('spellName', this.selectedSpell)
    }).subscribe((data: {
      damage: number,
      chakra: number,
      deadly: boolean,
      code: number
    }) => {
    }, () => {
    });
  }

  summon() {
    this.http.post('http://localhost:8080/fight/summon' +
      this.type.substring(0, 1).toUpperCase() +
      this.type.substring(1).toLowerCase(), null, {
      withCredentials: true,
      params: new HttpParams().append('fightId', this.id.toString())
    }).subscribe((response: NinjaAnimal) => {
      console.log(response);
      this.summonEnabled = false;
      this.drawAnimal(response, true);
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
    } else {
      alert(this.transl.transform('Not your turn!'));
    }

  }

  setPosition(element: HTMLElement, i: number, margin = 0) {
    element.style.position = 'absolute';
    element.style.bottom = (margin + 40 * ((i + 1) % 2)) + 'px';
    element.style.left = (80 * Math.round(i / 2) + 40 * ((i + 1) % 2)) + 'px';
  }

  setHPPercent(stats: HTMLElement, hp: number) {
    (<HTMLElement>stats.getElementsByClassName('hp')[0]).style.width = hp + '%';
  }

  setChakraPercent(stats: HTMLElement, mp: number) {
    (<HTMLElement>stats.getElementsByClassName('mp')[0]).style.width = mp + '%';
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
    this.statsElements[this.parent.login].style.display = 'none';
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
    this.statsElements[this.parent.login].style.display = 'none';
    let counter = 0;
    let translate: string;
    const anim = setInterval(() => {
      counter++;
      this.animalsElements[animal.name.substring(0, 3)].style.transform = 'rotate(-' + counter + 'deg)';
      if (counter < 27) {
        translate = 'translate(0,-' + (counter) * 2 + 'px)';
        this.animalsElements[animal.name].style.transform += translate;
      } else {
        this.animalsElements[animal.name].style.transform += translate;
      }
      if (counter === 87) {
        clearInterval(anim);
      }
    }, 3);
  }

  finishFight(death: boolean, victory: boolean, loss: boolean): void {
    clearTimeout(this.timer);
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
      this.statsElements[animal.name.substring(0, 3)] = <HTMLElement>element.location.nativeElement;
      this.setPosition(<HTMLElement>element.location.nativeElement, 7);
    } else {
      element = this.enemiesContainer.createComponent(factory);
      element.instance.animalName = animal.name;
      this.statsElements[animal.name.substring(0, 3)] = <HTMLElement>element.location.nativeElement;
      (<HTMLElement>element).style.position = 'absolute';
      (<HTMLElement>element).style.bottom = '60px';
      (<HTMLElement>element).style.right = '80px';
      (<HTMLElement>element).style.transform = 'scaleX(-1)';
    }

    this.animalsElements[animal.name] = <HTMLElement>element;
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

}
