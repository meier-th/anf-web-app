import {Injectable} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {Router} from '@angular/router';
import {CookieService} from 'ngx-cookie-service';
import {AreaService} from '../../services/area/area.service';
import {FightService} from '../../services/fight/fight.service';
import {LobbyApiService} from '../api/lobby-api.service';
import {APP_MESSAGES, APP_TIMINGS} from '../constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class QueueFacadeService {
  area: string;
  users: string[] = [];
  players: string[] = [];
  openLobbies: Array<{
    lobbyUuid: string;
    fightMode: string;
    leader: string;
    players: string[];
    playerCount: number;
    capacity: number;
    availableSlots: number;
  }> = [];
  type: string;
  disabled = true;
  isPvpLobbyMode = false;
  id: string;
  lobbyUuid = '';
  joinLobbyUuid = '';
  isLeader = false;
  expectedPlayers = 1;
  statusMessage: string = APP_MESSAGES.queuePreparing;
  copyFeedback = '';
  started = false;

  private readonly username: string;
  private pollLobbyId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private areaService: AreaService,
    private cookieService: CookieService,
    private fightService: FightService,
    private lobbyApi: LobbyApiService,
    private router: Router
  ) {
    this.username = this.cookieService.get('username');
  }

  init(): void {
    this.area = this.areaService.selectedArea;
    this.type = this.areaService.pvp ? 'PVP' : 'PVE';
    this.isPvpLobbyMode = this.areaService.pvp;
    this.expectedPlayers = this.areaService.pvp ? 2 : 1;
    this.lobbyApi.getReadyUsers().subscribe((data: string[]) => {
      this.users = data.filter((item) => item !== this.cookieService.get('username'));
    });
    if (this.isPvpLobbyMode) {
      this.statusMessage = APP_MESSAGES.queueSelectOrCreate;
      this.loadOpenLobbies();
      return;
    }
    this.createLobby();
  }

  dispose(): void {
    this.cleanupLobby();
  }

  joinLobby(): void {
    const lobbyUuid = this.joinLobbyUuid.trim();
    if (!lobbyUuid) {
      return;
    }
    this.joinLobbyByUuid(lobbyUuid);
  }

  joinExistingLobby(lobbyUuid: string): void {
    this.joinLobbyByUuid(lobbyUuid);
  }

  createLobby(): void {
    if (this.lobbyUuid) {
      this.statusMessage = APP_MESSAGES.queueAlreadyInLobby;
      return;
    }
    this.lobbyApi.createLobby(this.areaService.pvp ? 'PVP' : 'TEAM_PVE').subscribe((response) => {
      this.lobbyUuid = response.lobbyUuid;
      this.id = response.lobbyUuid;
      this.isLeader = true;
      this.statusMessage = APP_MESSAGES.queueCreated;
      this.refreshLobby();
      this.startLobbyPolling();
      this.loadOpenLobbies();
    });
  }

  leaveLobby(): void {
    if (!this.lobbyUuid) {
      return;
    }
    if (this.pollLobbyId) {
      clearInterval(this.pollLobbyId);
      this.pollLobbyId = null;
    }
    const lobbyToLeave = this.lobbyUuid;
    const request = this.isLeader ? this.lobbyApi.deleteLobby(lobbyToLeave) : this.lobbyApi.leaveLobby(lobbyToLeave);
    request.subscribe({
      next: () => {
        this.clearCurrentLobbyState();
        if (this.isPvpLobbyMode) {
          this.statusMessage = APP_MESSAGES.queueSelectOrCreate;
          this.loadOpenLobbies();
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.clearCurrentLobbyState();
          if (this.isPvpLobbyMode) {
            this.statusMessage = APP_MESSAGES.queueSelectOrCreate;
            this.loadOpenLobbies();
          }
        }
      }
    });
  }

  loadOpenLobbies(): void {
    if (!this.isPvpLobbyMode) {
      return;
    }
    this.lobbyApi.listOpenPvpLobbies().subscribe((response) => {
      this.openLobbies = (response.lobbies ?? []).filter((lobby) => lobby.availableSlots > 0);
    });
  }

  startFight(onStarted?: () => void): void {
    if (!this.lobbyUuid) {
      return;
    }
    this.lobbyApi.startFight(this.lobbyUuid, this.areaService.pvp ? undefined : this.area).subscribe((data) => {
      this.started = true;
      this.fightService.type = this.areaService.pvp ? 'pvp' : 'pve';
      this.fightService.id = data.fightUuid;
      this.fightService.valuesSet = true;
      this.router.navigateByUrl(`/fight/${this.fightService.type}/${data.fightUuid}`);
      onStarted?.();
    });
  }

  copyLobbyCode(): void {
    if (!this.lobbyUuid) {
      return;
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(this.lobbyUuid).then(() => {
        this.copyFeedback = APP_MESSAGES.lobbyCodeCopied;
      }).catch(() => {
        this.copyFallback();
      });
      return;
    }
    this.copyFallback();
  }

  refreshLobby(): void {
    if (!this.lobbyUuid) {
      return;
    }
    this.lobbyApi.getLobby(this.lobbyUuid).subscribe({
      next: (lobby) => {
        this.players = lobby.players ?? [];
        this.isLeader = lobby.leader === this.username;
        this.disabled = !(this.isLeader && this.players.length >= this.expectedPlayers);
        this.statusMessage = this.buildStatusMessage();
        this.loadOpenLobbies();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.started = true;
          if (this.pollLobbyId) {
            clearInterval(this.pollLobbyId);
            this.pollLobbyId = null;
          }
        }
      }
    });
  }

  private joinLobbyByUuid(lobbyUuid: string): void {
    if (this.lobbyUuid && this.lobbyUuid !== lobbyUuid) {
      this.statusMessage = APP_MESSAGES.queueLeaveCurrentFirst;
      return;
    }
    this.lobbyApi.joinLobby(lobbyUuid).subscribe(() => {
      this.lobbyUuid = lobbyUuid;
      this.id = lobbyUuid;
      this.statusMessage = APP_MESSAGES.queueJoined;
      this.refreshLobby();
      this.startLobbyPolling();
      this.loadOpenLobbies();
    });
  }

  private copyFallback(): void {
    const input = document.createElement('input');
    input.value = this.lobbyUuid;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      this.copyFeedback = APP_MESSAGES.lobbyCodeCopied;
    } catch {
      this.copyFeedback = APP_MESSAGES.queueCopyFailed;
    }
    document.body.removeChild(input);
  }

  private buildStatusMessage(): string {
    if (!this.lobbyUuid) {
      return APP_MESSAGES.queuePreparing;
    }
    if (!this.isLeader) {
      return `Waiting for leader. ${this.players.length}/${this.expectedPlayers} players in lobby.`;
    }
    if (this.players.length < this.expectedPlayers) {
      return `Waiting for players: ${this.players.length}/${this.expectedPlayers}.`;
    }
    return APP_MESSAGES.queueReadyToStart;
  }

  private startLobbyPolling(): void {
    if (this.pollLobbyId) {
      return;
    }
    this.pollLobbyId = setInterval(() => this.refreshLobby(), APP_TIMINGS.lobbyPollMs);
  }

  private cleanupLobby(): void {
    if (this.pollLobbyId) {
      clearInterval(this.pollLobbyId);
      this.pollLobbyId = null;
    }
    if (!this.lobbyUuid || this.started || this.router.url.startsWith('/fight/')) {
      return;
    }
    if (this.isLeader) {
      this.lobbyApi.deleteLobby(this.lobbyUuid).subscribe({
        error: (_error: HttpErrorResponse) => {}
      });
      return;
    }
    this.lobbyApi.leaveLobby(this.lobbyUuid).subscribe({
      error: (_error: HttpErrorResponse) => {}
    });
  }

  private clearCurrentLobbyState(): void {
    this.id = '';
    this.lobbyUuid = '';
    this.players = [];
    this.isLeader = false;
    this.disabled = true;
    this.copyFeedback = '';
  }
}
