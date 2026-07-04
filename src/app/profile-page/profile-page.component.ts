import {AfterViewChecked, Component, OnDestroy, OnInit} from '@angular/core';
import {User} from '../classes/user';
import {Message} from '../classes/message';
import {ConfirmationService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {QueueComponent} from '../queue/queue.component';
import {AreaService} from '../services/area/area.service';
import {CookieService} from 'ngx-cookie-service';
import {AnimalRaceChoiceComponent} from '../animal-race-choice/animal-race-choice.component';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {Stats} from '../classes/stats';
import {HistoryComponent} from '../history/history.component';
import {SpellsComponent} from '../spells/spells.component';
import {Router} from '@angular/router';
import {ProfileApiService} from '../core/api/profile-api.service';
import {ProfileDomainService} from '../core/domain/profile-domain.service';
import {DIALOG_SIZES} from '../core/constants/app.constants';
import {ProfileRenderService} from '../core/ui/profile-render.service';
import {ProfileReadyFacadeService} from '../core/facade/profile-ready.facade.service';
import { CharacterComponent } from '../character/character.component';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { FriendsPageComponent } from '../friends-page/friends-page.component';
import { ChatComponent } from '../chat/chat.component';
import { UsersListComponent } from '../users-list/users-list.component';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-profile-page',
    templateUrl: './profile-page.component.html',
    styleUrls: ['./profile-page.component.less'],
    providers: [DialogService, ConfirmationService],
    animations: [
        trigger('load1', [
            state('hidden', style({
                bottom: '-20%',
                display: 'none',
                opacity: '0.3'
            })),
            state('default', style({})),
            transition('hidden => default', [
                animate('0.5s')
            ])
        ]),
        trigger('load2', [
            state('hidden', style({
                bottom: '-20%',
                display: 'none',
                opacity: '0.3'
            })),
            state('default', style({})),
            transition('hidden => default', [
                animate('0.8s')
            ])
        ]),
        trigger('load3', [
            state('hidden', style({
                bottom: '-20%',
                display: 'none',
                opacity: '0.3'
            })),
            state('default', style({})),
            transition('hidden => default', [
                animate('1.1s')
            ])
        ])
    ],
    imports: [CharacterComponent, Bind, Button, FriendsPageComponent, ChatComponent, UsersListComponent, TranslatePipe]
})
export class ProfilePageComponent implements OnInit, AfterViewChecked, OnDestroy {
  public user: User;
  public loaded = false;
  public unreadMessages: Message[];
  public friends: string[];
  public checked = false;
  dialog: DynamicDialogRef;
  private statsMissingFromProfile = false;
  private hoveredGround: HTMLElement | null = null;

  constructor(private dialogService: DialogService, private areaService: AreaService,
              private cookieService: CookieService, private confService: ConfirmationService,
              private router: Router,
              private profileApi: ProfileApiService, private profileDomain: ProfileDomainService,
              private profileRender: ProfileRenderService,
              private profileReadyFacade: ProfileReadyFacadeService) {

  }

  ngOnInit() {
    //document.documentElement.style.overflowY = 'hidden';
    this.profileApi.getProfile().subscribe(data => {
      this.statsMissingFromProfile = !data.stats;
      this.user = this.profileDomain.normalizeUser(data);
      if (typeof this.user.character.resistance === 'number') {
        this.user.character.resistance = parseFloat(this.user.character.resistance.toFixed(2));
      }
      this.loaded = true;
      this.loadStatsIfMissing();
    }, () => {
      this.router.navigateByUrl('start');
    });
    this.profileReadyFacade.init(() => this.user?.login);
  }

  public changeReadyState() {
    this.profileReadyFacade.setReadyState(this.ready);
  }

  public setReadyState(isReady: boolean): void {
    if (this.ready === isReady) {
      return;
    }
    this.profileReadyFacade.setReadyState(isReady);
  }

  changeHair() {
    this.profileRender.renderProfileAppearance(this.user);
  }

  changeSkin() {
    this.profileRender.renderProfileAppearance(this.user);
  }

  changeClothes() {
    this.profileRender.renderProfileAppearance(this.user);
  }

  setGender() {
    this.profileRender.renderProfileAppearance(this.user);
  }

  upgrade(param: string): void {
    this.profileApi.upgradeCharacter(param).subscribe();
    this.profileDomain.applyUpgradeLocally(this.user, param);
  }

  private loadStatsIfMissing() {
    if (!this.user || !this.statsMissingFromProfile) {
      return;
    }
    this.profileApi.getStats(this.user.login).subscribe({
      next: (stats) => {
        this.user.stats = {
          ...this.profileDomain.createDefaultStats(),
          ...stats
        };
      },
      error: () => {
        this.user.stats = this.profileDomain.createDefaultStats();
      }
    });
  }

  chooseAnimalRace(): void {
    this.dialog = this.dialogService.open(AnimalRaceChoiceComponent, {
      width: DIALOG_SIZES.raceChoice.width,
      height: DIALOG_SIZES.raceChoice.height,
      data: {
        onSelected: (raceName: string) => {
          this.user.character.animalRace = raceName;
        }
      }
    });
  }

  openFightLog(): void {
    this.dialog = this.dialogService.open(HistoryComponent, {
      width: DIALOG_SIZES.queue.width,
      height: DIALOG_SIZES.queue.height,
      closable: false
    });
  }

  openSpellbook(): void {
    this.dialog = this.dialogService.open(SpellsComponent, {
      width: DIALOG_SIZES.queue.width,
      height: DIALOG_SIZES.queue.height,
      closable: false
    });
  }

  ngAfterViewChecked() {
    if (!this.checked && this.loaded) {
      this.checked = true;
      this.profileRender.renderProfileAppearance(this.user);
      const dialogService = this.dialogService;
      const areaService = this.areaService;
      const array = document.querySelectorAll('.ground, .bidju');
      const that = this;
      for (let i = 0; i < array.length; i++) {
        (<HTMLElement>array[i]).onclick = function () {
          that.dialog = dialogService.open(QueueComponent, {
            width: DIALOG_SIZES.queue.width,
            height: DIALOG_SIZES.queue.height,
            closable: false
          });
          areaService.selectedArea = (<HTMLElement>this).id;
          areaService.pvp = (<HTMLElement>array[i]).classList.contains('ground');
        };
      }

      const map = document.getElementById('map');
      if (map) {
        map.addEventListener('mousemove', (event: MouseEvent) => {
          const stack = document.elementsFromPoint(event.clientX, event.clientY);
          const ground = stack.find((element) => element.classList?.contains('ground')) as HTMLElement | undefined;
          this.hoveredGround = this.profileRender.setHoveredGround(this.hoveredGround, ground ?? null);
        });
        map.addEventListener('mouseleave', () => {
          this.hoveredGround = this.profileRender.setHoveredGround(this.hoveredGround, null);
        });
      }
    }
  }

  addEmail(): void {
    
  }

  ngOnDestroy() {
    this.profileReadyFacade.destroy();
    this.hoveredGround = this.profileRender.setHoveredGround(this.hoveredGround, null);
    document.documentElement.style.overflowY = 'scroll';
  }
  get ready(): boolean { return this.profileReadyFacade.ready; }
  set ready(value: boolean) { this.profileReadyFacade.ready = value; }

}
