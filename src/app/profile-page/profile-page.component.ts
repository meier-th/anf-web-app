import {AfterContentInit, AfterViewChecked, AfterViewInit, Component, Injector, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {User} from '../classes/user';
import {Message} from '../classes/message';
import {MainComponent} from '../main/main.component';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {QueueComponent} from '../queue/queue.component';
import {AreaService} from '../services/area/area.service';
import {Observable} from 'rxjs';
import {CookieService} from 'ngx-cookie-service';
import {Stomp} from '@stomp/stompjs';
import {AnimalRaceChoiceComponent} from '../animal-race-choice/animal-race-choice.component';
import SockJS from 'sockjs-client';
import {animate, state, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'app-profile-page',
  standalone: false,
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.less'],
  providers: [DialogService, ConfirmationService],
  animations: [
    trigger('load1', [
      state('hidden', style({
          bottom: '-20%',
          display: 'none',
          opacity: '0.3'
        })
      ),
      state('default', style({})
      ),
      transition('hidden => default', [
        animate('0.5s')
      ])]
    ),
    trigger('load2', [
      state('hidden', style({
          bottom: '-20%',
          display: 'none',
          opacity: '0.3'
        })
      ),
      state('default', style({})
      ),
      transition('hidden => default', [
        animate('0.8s')
      ])]
    ),
    trigger('load3', [
      state('hidden', style({
          bottom: '-20%',
          display: 'none',
          opacity: '0.3'
        })
      ),
      state('default', style({})
      ),
      transition('hidden => default', [
        animate('1.1s')
      ])]
    )
  ]
})
export class ProfilePageComponent implements OnInit, AfterViewChecked, OnDestroy {
  public user: User;
  public loaded = false;
  public unreadMessages: Message[];
  public friends: string[];
  public parent = this.injector.get(MainComponent);
  public ready = false;
  public checked = false;
  dialog: DynamicDialogRef;
  private stompClient;

  constructor(private http: HttpClient, private injector: Injector,
              private dialogService: DialogService, private areaService: AreaService,
              private cookieService: CookieService, private confService: ConfirmationService) {

  }

  ngOnInit() {
    //document.documentElement.style.overflowY = 'hidden';
    this.http.get<User>('http://localhost:31480/profile', {withCredentials: true}).subscribe(data => {
      this.loaded = true;
      this.user = data;
      this.user.character.resistance = parseFloat(this.user.character.resistance.toFixed(2));
    }, () => {
      this.parent.loggedIn = false;
      this.parent.router.navigateByUrl('start');
    });
    this.ready = this.cookieService.get('ready') === 'true';
    this.subscribeForWebsockets();
  }

  subscribeForWebsockets() {
    const ws = new SockJS('http://localhost:31480/socket');
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/online', (message) => {
        const str = message.body; // format: {username}:{online/offline}
        const i = str.indexOf(':');
        const user = str.substring(0, i);
        const type = str.substring(i + 1, str.length);
        if (user === that.user.login && type === 'offline' && that.ready === true) {
          that.ready = false;
        }
      });
    });
  }

  public changeReadyState() {
    let request: Observable<Object>;
    if (this.ready) {
      this.ready = true;
      setTimeout(() => {
        this.ready = false;
      }, 300000);
      request = this.http.get('http://localhost:31480/profile/online', {withCredentials: true});
    } else {
      this.ready = false;
      request = this.http.get('http://localhost:31480/profile/offline', {withCredentials: true});
    }
    request.subscribe(() => {
      this.cookieService.set('ready', this.ready.toString(), new Date(Date.now() + 300000));
    });
  }

  changeHair() {
    const array = document.getElementsByClassName('hair');
    let color = this.user.character.appearance.hairColour;
    switch (this.user.character.appearance.hairColour) {
      case 'YELLOW':
        color = '#DEAB7F';
        break;
      case 'BROWN':
        color = '#A53900';
        break;
      case 'BLACK':
        color = '#2D221C';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  changeSkin() {
    const array = document.getElementsByClassName('skin');
    let color = this.user.character.appearance.skinColour;
    switch (this.user.character.appearance.skinColour) {
      case 'BLACK':
        color = '#6E2B12';
        break;
      case 'WHITE':
        color = '#EBCCAB';
        break;
      case 'LATIN':
        color = '#C37C4D';
        break;
      case 'DARK':
        color = '#934C1D';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  changeClothes() {
    const array = document.getElementsByClassName('clothes');
    let color = this.user.character.appearance.clothesColour;
    switch (this.user.character.appearance.clothesColour) {
      case 'RED':
        color = 'crimson';
        break;
      case 'GREEN':
        color = '#81E890';
        break;
      case 'BLUE':
        color = 'cornflowerblue';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  setGender() {
    (<HTMLElement>document.getElementsByClassName('powers')[0]).style.display = 'none';
    const males = document.getElementsByClassName('male');
    const females = document.getElementsByClassName('female');
    if (this.user.character.appearance.gender === 'FEMALE') {
      (<HTMLElement>females[0]).style.display = 'block';
      (<HTMLElement>males[0]).style.display = 'none';
    } else {
      (<HTMLElement>males[0]).style.display = 'block';
      (<HTMLElement>females[0]).style.display = 'none';
    }
    this.user.character.appearance.gender = this.user.character.appearance.gender ? 'FEMALE' : 'MALE';
  }

  upgrade(param: string): void {
    this.http.post('http://localhost:31480/profile/character',
      new HttpParams().set('quality', param),
      {
        headers:
          new HttpHeaders(
            {
              'Content-Type': 'application/x-www-form-urlencoded'
            }),
        withCredentials: true
      }).subscribe(msg => {
    });
    if (param === 'hp') {
      this.user.character.maxHp += 15;
    } else if (param === 'chakra') {
      this.user.character.maxChakra += 7;
    } else if (param === 'damage') {
      this.user.character.physicalDamage += 4;
    } else {
      this.user.character.resistance += parseFloat(((1 - this.user.character.resistance) / 4).toFixed(2));
    }
    this.user.stats.upgradePoints--;
  }

  chooseAnimalRace(): void {
    this.dialog = this.dialogService.open(AnimalRaceChoiceComponent, {width: '800px', height: '600px'});
  }

  ngAfterViewChecked() {
    if (!this.checked && this.loaded) {
      this.checked = true;
      this.changeClothes();
      this.changeHair();
      this.changeSkin();
      this.setGender();
      const dialogService = this.dialogService;
      const areaService = this.areaService;
      const array = document.querySelectorAll('.ground, .bidju');
      const that = this;
      for (let i = 0; i < array.length; i++) {
        (<HTMLElement>array[i]).onclick = function () {
          console.log('kek');
          that.parent.dialog = dialogService.open(QueueComponent, {width: '440px', height: '200px'});
          areaService.selectedArea = (<HTMLElement>this).id;
          areaService.pvp = (<HTMLElement>array[i]).classList.contains('ground');
        };
      }
    }
  }

  addEmail(): void {
    
  }

  ngOnDestroy() {
    document.documentElement.style.overflowY = 'scroll';
  }

}
