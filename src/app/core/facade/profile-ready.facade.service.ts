import {Injectable} from '@angular/core';
import {CompatClient} from '@stomp/stompjs';
import {CookieService} from 'ngx-cookie-service';
import {SocialRealtimeService} from '../realtime/social-realtime.service';
import {ProfileApiService} from '../api/profile-api.service';
import {APP_TIMINGS} from '../constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class ProfileReadyFacadeService {
  ready = false;
  private stompClient: CompatClient | undefined;
  private readyTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readyHeartbeatId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private cookieService: CookieService,
    private socialRealtime: SocialRealtimeService,
    private profileApi: ProfileApiService
  ) {}

  init(userLoginProvider: () => string | undefined): void {
    this.ready = this.cookieService.get('ready') === 'true';
    if (this.ready) {
      this.sendReadyState(true);
      this.startReadyHeartbeat();
      this.scheduleReadyAutoOff();
    }
    this.stompClient = this.socialRealtime.connect((client) => {
      this.socialRealtime.subscribeOnline(client, (str) => {
        const i = str.indexOf(':');
        const user = str.substring(0, i);
        const type = str.substring(i + 1, str.length);
        if (user === userLoginProvider() && type === 'offline' && this.ready) {
          this.ready = false;
        }
      });
    });
  }

  destroy(): void {
    this.socialRealtime.disconnect(this.stompClient);
    this.stopReadyHeartbeat();
    this.clearReadyAutoOff();
  }

  setReadyState(isReady: boolean): void {
    if (this.ready === isReady) {
      return;
    }
    this.ready = isReady;
    this.sendReadyState(this.ready);
    if (this.ready) {
      this.startReadyHeartbeat();
      this.scheduleReadyAutoOff();
    } else {
      this.stopReadyHeartbeat();
      this.clearReadyAutoOff();
    }
    this.cookieService.set('ready', this.ready.toString(), new Date(Date.now() + APP_TIMINGS.readyAutoOffMs));
  }

  private sendReadyState(isReady: boolean): void {
    this.profileApi.setReadyState(isReady).subscribe();
  }

  private startReadyHeartbeat(): void {
    if (this.readyHeartbeatId) {
      return;
    }
    this.readyHeartbeatId = setInterval(() => {
      if (this.ready) {
        this.sendReadyState(true);
      }
    }, APP_TIMINGS.onlineHeartbeatMs);
  }

  private stopReadyHeartbeat(): void {
    if (!this.readyHeartbeatId) {
      return;
    }
    clearInterval(this.readyHeartbeatId);
    this.readyHeartbeatId = null;
  }

  private scheduleReadyAutoOff(): void {
    this.clearReadyAutoOff();
    this.readyTimeoutId = setTimeout(() => {
      if (!this.ready) {
        return;
      }
      this.setReadyState(false);
    }, APP_TIMINGS.readyAutoOffMs);
  }

  private clearReadyAutoOff(): void {
    if (!this.readyTimeoutId) {
      return;
    }
    clearTimeout(this.readyTimeoutId);
    this.readyTimeoutId = null;
  }
}
