import {Component, OnDestroy, OnInit, Optional} from '@angular/core';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {QueueFacadeService} from '../core/facade/queue.facade.service';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-queue',
    templateUrl: './queue.component.html',
    styleUrls: ['./queue.component.less'],
    imports: [Bind, Button, FormsModule, TranslatePipe]
})
export class QueueComponent implements OnInit, OnDestroy {
  constructor(private queueFacade: QueueFacadeService,
              @Optional() private dialogRef: DynamicDialogRef | null) {}

  get area(): string { return this.queueFacade.area; }
  get users(): string[] { return this.queueFacade.users; }
  get players(): string[] { return this.queueFacade.players; }
  get openLobbies() { return this.queueFacade.openLobbies; }
  get type(): string { return this.queueFacade.type; }
  get disabled(): boolean { return this.queueFacade.disabled; }
  get isPvpLobbyMode(): boolean { return this.queueFacade.isPvpLobbyMode; }
  get id(): string { return this.queueFacade.id; }
  get lobbyUuid(): string { return this.queueFacade.lobbyUuid; }
  get isLeader(): boolean { return this.queueFacade.isLeader; }
  get expectedPlayers(): number { return this.queueFacade.expectedPlayers; }
  get statusMessage(): string { return this.queueFacade.statusMessage; }
  get copyFeedback(): string { return this.queueFacade.copyFeedback; }
  get started(): boolean { return this.queueFacade.started; }
  get joinLobbyUuid(): string { return this.queueFacade.joinLobbyUuid; }
  set joinLobbyUuid(value: string) { this.queueFacade.joinLobbyUuid = value; }

  ngOnInit() {
    this.queueFacade.init(() => this.dialogRef?.close());
  }

  joinLobby(): void {
    this.queueFacade.joinLobby();
  }

  joinExistingLobby(lobbyUuid: string): void {
    this.queueFacade.joinExistingLobby(lobbyUuid);
  }

  createLobby(): void {
    this.queueFacade.createLobby();
  }

  leaveLobby(): void {
    this.queueFacade.leaveLobby();
  }

  loadOpenLobbies(): void {
    this.queueFacade.loadOpenLobbies();
  }

  startFight() {
    this.queueFacade.startFight();
  }

  closeLobby(): void {
    this.queueFacade.dispose();
    this.dialogRef?.close();
  }

  refreshLobby(): void {
    this.queueFacade.refreshLobby();
  }

  copyLobbyCode(): void {
    this.queueFacade.copyLobbyCode();
  }

  ngOnDestroy() {
    this.queueFacade.dispose();
  }

}
