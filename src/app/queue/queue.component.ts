import {Component, Injector, OnDestroy, OnInit, Optional} from '@angular/core';
import {AreaService} from '../services/area/area.service';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {CookieService} from 'ngx-cookie-service';
import {FightService} from '../services/fight/fight.service';
import {MainComponent} from '../main/main.component';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {ApiConfigService} from '../core/config/api-config.service';

@Component({
  selector: 'app-queue',
  standalone: false,
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.less']
})
export class QueueComponent implements OnInit, OnDestroy {

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
  parent = this.injector.get(MainComponent);
  id: string;
  lobbyUuid = '';
  joinLobbyUuid = '';
  isLeader = false;
  expectedPlayers = 1;
  statusMessage = 'Preparing lobby...';
  copyFeedback = '';
  private readonly username: string;
  private pollLobbyId: ReturnType<typeof setInterval> | null = null;
  started = false;
  constructor(private areaService: AreaService, private http: HttpClient,
              private cookieService: CookieService, private fightService: FightService,
              private injector: Injector,
              private apiConfig: ApiConfigService,
              @Optional() private dialogRef: DynamicDialogRef | null) {
    this.username = this.cookieService.get('username');
  }

  ngOnInit() {
    this.area = this.areaService.selectedArea;
    this.type = this.areaService.pvp ? 'PVP' : 'PVE';
    this.isPvpLobbyMode = this.areaService.pvp;
    this.expectedPlayers = this.areaService.pvp ? 2 : 1;
    this.http.get(this.apiConfig.buildUrl('/ready'), {withCredentials: true}).subscribe((data: string[]) => {
      this.users = data.filter((item) => item !== this.cookieService.get('username'));
    });
    if (this.isPvpLobbyMode) {
      this.statusMessage = 'Select a lobby to join, create your own, or use a code.';
      this.loadOpenLobbies();
      return;
    }
    this.createLobby();
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
      this.statusMessage = 'You are already in a lobby.';
      return;
    }
    this.http.post<{ lobbyUuid: string }>(
      this.apiConfig.buildUrl('/fight/lobbies'),
      null,
      {
      withCredentials: true,
      params: new HttpParams().append('mode', this.areaService.pvp ? 'PVP' : 'TEAM_PVE')
    }).subscribe((response) => {
      this.lobbyUuid = response.lobbyUuid;
      this.id = response.lobbyUuid;
      this.isLeader = true;
      this.statusMessage = 'Lobby created. Share the code and wait for players.';
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
    const request = this.isLeader
      ? this.http.delete(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyToLeave}`), {withCredentials: true})
      : this.http.post(this.apiConfig.buildUrl(`/fight/lobbies/${lobbyToLeave}/leave`), null, {withCredentials: true});
    request.subscribe({
      next: () => {
        this.clearCurrentLobbyState();
        if (this.isPvpLobbyMode) {
          this.statusMessage = 'Select a lobby to join, create your own, or use a code.';
          this.loadOpenLobbies();
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.clearCurrentLobbyState();
          if (this.isPvpLobbyMode) {
            this.statusMessage = 'Select a lobby to join, create your own, or use a code.';
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
    this.http.get<{
      lobbies: Array<{
        lobbyUuid: string;
        fightMode: string;
        leader: string;
        players: string[];
        playerCount: number;
        capacity: number;
        availableSlots: number;
      }>
    }>(this.apiConfig.buildUrl('/fight/lobbies'), {
      withCredentials: true,
      params: new HttpParams().append('mode', 'PVP')
    }).subscribe((response) => {
      this.openLobbies = (response.lobbies ?? []).filter((lobby) => lobby.availableSlots > 0);
    });
  }

  private joinLobbyByUuid(lobbyUuid: string): void {
    if (this.lobbyUuid && this.lobbyUuid !== lobbyUuid) {
      this.statusMessage = 'Leave your current lobby first.';
      return;
    }
    this.http.post(
      this.apiConfig.buildUrl(`/fight/lobbies/${lobbyUuid}/join`),
      null,
      {
      withCredentials: true
    }).subscribe(() => {
      this.lobbyUuid = lobbyUuid;
      this.id = lobbyUuid;
      this.statusMessage = 'Joined lobby. Waiting for leader to start.';
      this.refreshLobby();
      this.startLobbyPolling();
      this.loadOpenLobbies();
    });
  }

  startFight() {
    if (!this.lobbyUuid) {
      return;
    }
    let params = new HttpParams();
    if (!this.areaService.pvp) {
      params = params.append('bossId', this.area);
    }
    this.http.post<{ fightUuid: string }>(
      this.apiConfig.buildUrl(`/fight/lobbies/${this.lobbyUuid}/start`),
      null,
      {
      withCredentials: true,
      params
    }).subscribe((data) => {
      this.started = true;
      this.fightService.type = this.areaService.pvp ? 'pvp' : 'pve';
      this.fightService.id = data.fightUuid;
      this.fightService.valuesSet = true;
      this.parent.router.navigateByUrl(`/fight/${this.fightService.type}/${data.fightUuid}`);
      this.dialogRef?.close();
    });
  }

  closeLobby(): void {
    this.cleanupLobby();
    this.dialogRef?.close();
  }

  refreshLobby(): void {
    if (!this.lobbyUuid) {
      return;
    }
    this.http.get<{
      lobbyUuid: string;
      fightMode: string;
      leader: string;
      players: string[];
    }>(this.apiConfig.buildUrl(`/fight/lobbies/${this.lobbyUuid}`), {withCredentials: true})
      .subscribe({
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

  copyLobbyCode(): void {
    if (!this.lobbyUuid) {
      return;
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(this.lobbyUuid).then(() => {
        this.copyFeedback = 'Lobby code copied.';
      }).catch(() => {
        this.copyFallback();
      });
      return;
    }
    this.copyFallback();
  }

  private copyFallback(): void {
    const input = document.createElement('input');
    input.value = this.lobbyUuid;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      this.copyFeedback = 'Lobby code copied.';
    } catch {
      this.copyFeedback = 'Could not copy automatically.';
    }
    document.body.removeChild(input);
  }

  private buildStatusMessage(): string {
    if (!this.lobbyUuid) {
      return 'Preparing lobby...';
    }
    if (!this.isLeader) {
      return `Waiting for leader. ${this.players.length}/${this.expectedPlayers} players in lobby.`;
    }
    if (this.players.length < this.expectedPlayers) {
      return `Waiting for players: ${this.players.length}/${this.expectedPlayers}.`;
    }
    return 'Ready to start.';
  }

  private startLobbyPolling(): void {
    if (this.pollLobbyId) {
      return;
    }
    this.pollLobbyId = setInterval(() => this.refreshLobby(), 3000);
  }

  private cleanupLobby(): void {
    if (this.pollLobbyId) {
      clearInterval(this.pollLobbyId);
      this.pollLobbyId = null;
    }
    if (!this.lobbyUuid || this.started || this.parent.router.url.startsWith('/fight/')) {
      return;
    }
    if (this.isLeader) {
      this.http.delete(this.apiConfig.buildUrl(`/fight/lobbies/${this.lobbyUuid}`), {
        withCredentials: true
      }).subscribe({
        error: (_error: HttpErrorResponse) => {}
      });
      return;
    }
    this.http.post(this.apiConfig.buildUrl(`/fight/lobbies/${this.lobbyUuid}/leave`), null, {
      withCredentials: true
    }).subscribe({
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

  ngOnDestroy() {
    this.cleanupLobby();
  }

}
