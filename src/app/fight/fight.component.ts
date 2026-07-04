import {animate, state, style, transition, trigger} from '@angular/animations';
import {Component, OnDestroy, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {Tooltip} from 'primeng/tooltip';
import {FightResultComponent} from '../fight-result/fight-result.component';
import {TranslatePipe} from '../services/translate.pipe';
import {FightFacadeService} from '../core/facade/fight.facade.service';
import {FightOutcomeService} from '../core/facade/fight-outcome.service';
import {FightSessionService} from '../core/facade/fight-session.service';
import {FightRealtimeService} from '../core/realtime/fight-realtime.service';
import {AttackAnnouncement, FightAnnouncementsService} from '../core/state/fight-announcements.service';
import {FightStateStore} from '../core/state/fight-state.store';
import {FightSceneService} from '../core/ui/fight-scene.service';

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
  imports: [Tooltip, FightResultComponent, TranslatePipe],
  providers: [
    FightFacadeService,
    FightStateStore,
    FightSceneService,
    FightSessionService,
    FightOutcomeService,
    FightAnnouncementsService,
    FightRealtimeService
  ]
})
export class FightComponent implements OnInit, OnDestroy {
  @ViewChild('alliesContainer', {read: ViewContainerRef})
  set alliesContainer(value: ViewContainerRef | undefined) {
    this._alliesContainer = value;
    this.syncContainers();
  }

  @ViewChild('enemiesContainer', {read: ViewContainerRef})
  set enemiesContainer(value: ViewContainerRef | undefined) {
    this._enemiesContainer = value;
    this.syncContainers();
  }

  private _alliesContainer?: ViewContainerRef;
  private _enemiesContainer?: ViewContainerRef;

  constructor(private readonly facade: FightFacadeService) {}

  ngOnInit() {
    this.facade.initFromRoute();
  }

  ngOnDestroy() {
    this.facade.dispose();
  }

  get announcements(): AttackAnnouncement[] {
    return this.facade.announcements;
  }

  get current(): string {
    return this.facade.current;
  }

  get currentUsername(): string {
    return this.facade.currentUsername;
  }

  get skills(): string[] {
    return this.facade.skills;
  }

  get map(): { [key: string]: string } {
    return this.facade.map;
  }

  get selectedSpell(): string {
    return this.facade.selectedSpell;
  }

  get summonEnabled(): boolean {
    return this.facade.summonEnabled;
  }

  get summonButtonSrc(): string {
    return this.facade.summonButtonSrc;
  }

  get attackEvents(): string[] {
    return this.facade.attackEvents;
  }

  get showDebugPanel(): boolean {
    return this.facade.showDebugPanel;
  }

  get debugLines(): string[] {
    return this.facade.debugLines;
  }

  get showFightResult(): boolean {
    return this.facade.showFightResult;
  }

  get turnLabel(): string {
    return this.facade.turnLabel;
  }

  get remainingSeconds(): number {
    return this.facade.remainingSeconds;
  }

  isSkillDisabled(skill: string): boolean {
    return this.facade.isSkillDisabled(skill);
  }

  selectSpell(event: MouseEvent) {
    this.facade.selectSpell(event);
  }

  summon() {
    this.facade.summon();
  }

  onSummonButtonImageError() {
    this.facade.onSummonButtonImageError();
  }

  onFightResultOk() {
    this.facade.onFightResultOk();
  }

  private syncContainers() {
    this.facade.setContainers(this._alliesContainer, this._enemiesContainer);
  }
}
