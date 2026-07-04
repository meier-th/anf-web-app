import {Injectable, computed, signal} from '@angular/core';
import {FIGHT_UI} from '../constants/app.constants';

export type AttackAnnouncement = {
  id: number;
  text: string;
  dismissTimer: ReturnType<typeof setTimeout>;
};

/**
 * Attack banner queue: schedules (optionally delayed) announcements and
 * auto-dismisses them. Scoped per fight so timers never leak across fights.
 */
@Injectable()
export class FightAnnouncementsService {
  private readonly _announcements = signal<AttackAnnouncement[]>([]);
  private announcementCounter = 0;
  private pendingDelays: Array<ReturnType<typeof setTimeout>> = [];

  readonly announcements = computed(() => this._announcements());

  schedule(text: string, delayed: boolean): void {
    const delay = delayed ? FIGHT_UI.announcementDelayMs : 0;
    const delayTimer = setTimeout(() => {
      const id = ++this.announcementCounter;
      const dismissTimer = setTimeout(() => this.dismiss(id), FIGHT_UI.announcementDurationMs);
      this._announcements.set([...this._announcements(), {id, text, dismissTimer}]);
      this.pendingDelays = this.pendingDelays.filter((it) => it !== delayTimer);
    }, delay);
    this.pendingDelays.push(delayTimer);
  }

  dismiss(id: number): void {
    const target = this._announcements().find((it) => it.id === id);
    if (target) {
      clearTimeout(target.dismissTimer);
    }
    this._announcements.set(this._announcements().filter((it) => it.id !== id));
  }

  clear(): void {
    this.pendingDelays.forEach((delayTimer) => clearTimeout(delayTimer));
    this.pendingDelays = [];
    this._announcements().forEach((announcement) => clearTimeout(announcement.dismissTimer));
    this._announcements.set([]);
  }
}
