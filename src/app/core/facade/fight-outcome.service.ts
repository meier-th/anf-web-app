import {Injectable, computed, signal} from '@angular/core';
import {Router} from '@angular/router';
import {FightEndService} from '../../services/fight-end.service';
import {ProfileApiService} from '../api/profile-api.service';
import {FIGHT_UI} from '../constants/app.constants';
import {FightAnnouncementsService} from '../state/fight-announcements.service';
import {SessionStore} from '../state/session.store';
import {FightStateStore} from '../state/fight-state.store';
import {FightSessionService} from './fight-session.service';

export type FightOutcome = {
  death: boolean;
  victory: boolean;
  loss: boolean;
  surrendered?: boolean;
};

/**
 * End-of-fight flow: captures the pre-fight rating, resolves win/loss/death
 * once the fight ends, populates the legacy FightEndService the fight-result
 * screen reads, and navigates away on acknowledgement.
 */
@Injectable()
export class FightOutcomeService {
  private readonly _showResult = signal(false);
  readonly showResult = computed(() => this._showResult());

  private ratingBeforeFight: number | undefined;

  constructor(
    private router: Router,
    private profileApi: ProfileApiService,
    private fightEndService: FightEndService,
    private sessionStore: SessionStore,
    private stateStore: FightStateStore,
    private session: FightSessionService,
    private announcements: FightAnnouncementsService
  ) {
  }

  prepareForNewFight(type: string): void {
    this.fightEndService.death = false;
    this.fightEndService.loss = false;
    this.fightEndService.victory = false;
    this.fightEndService.surrendered = false;
    this._showResult.set(false);
    this.captureRatingBeforeFight(type);
  }

  handleSurrenderState(attacker: string): void {
    if (this.stateStore.type() === 'pvp') {
      const surrenderedBySelf = (attacker ?? '') === this.sessionStore.username();
      this.finishFight({death: false, victory: !surrenderedBySelf, loss: surrenderedBySelf, surrendered: true});
      return;
    }
    this.finishFight({death: false, victory: false, loss: true, surrendered: true});
  }

  finishFight(outcome: FightOutcome): void {
    if (this.stateStore.fightEnded()) {
      return;
    }
    this.stateStore.markFightEnded();
    this.session.stopTurnTimer();
    this.announcements.clear();
    setTimeout(() => {
      this.fightEndService.death = outcome.death;
      this.fightEndService.loss = outcome.loss;
      this.fightEndService.victory = outcome.victory;
      this.fightEndService.surrendered = outcome.surrendered ?? false;
      this.resolveOutcomeAndShowResult();
    }, FIGHT_UI.finishDelayMs);
  }

  acknowledgeResult(): void {
    this._showResult.set(false);
    this.router.navigateByUrl('/main');
  }

  private captureRatingBeforeFight(type: string): void {
    if ((type ?? '').toLowerCase() !== 'pvp') {
      this.ratingBeforeFight = 0;
      return;
    }
    this.profileApi.getProfile().subscribe((profile) => {
      this.ratingBeforeFight = profile?.stats?.rating;
    });
  }

  private resolveOutcomeAndShowResult(): void {
    if (this.stateStore.type() !== 'pvp') {
      this.fightEndService.ratingChange = 0;
      this.profileApi.getPveHistory().subscribe({
        next: (history) => {
          const latestResult = `${history?.[0]?.result ?? ''}`.toLowerCase();
          const localPlayerDead = this.stateStore.hasLocalPlayerDied() || this.stateStore.isLocalPlayerDead();
          if (latestResult === 'win') {
            this.fightEndService.victory = true;
            this.fightEndService.loss = false;
            this.fightEndService.death = false;
          } else if (latestResult === 'died') {
            this.fightEndService.victory = false;
            this.fightEndService.loss = true;
            this.fightEndService.death = true;
          } else if (latestResult === 'loss') {
            this.fightEndService.victory = false;
            this.fightEndService.loss = true;
            this.fightEndService.death = localPlayerDead;
          }
          this._showResult.set(true);
        },
        error: () => this._showResult.set(true)
      });
      return;
    }
    this.profileApi.getProfile().subscribe({
      next: (profile) => {
        const currentRating = profile?.stats?.rating;
        if (Number.isFinite(currentRating) && Number.isFinite(this.ratingBeforeFight)) {
          this.fightEndService.ratingChange = Number(currentRating) - Number(this.ratingBeforeFight);
        } else {
          this.fightEndService.ratingChange = 0;
        }
        // PvP outcome should be derived from authoritative rating update.
        this.fightEndService.victory = this.fightEndService.ratingChange > 0;
        this.fightEndService.loss = this.fightEndService.ratingChange < 0;
        this.fightEndService.death = this.stateStore.isLocalPlayerDead();
        this._showResult.set(true);
      },
      error: () => {
        this.fightEndService.ratingChange = 0;
        this.fightEndService.death = this.stateStore.isLocalPlayerDead();
        this._showResult.set(true);
      }
    });
  }
}
