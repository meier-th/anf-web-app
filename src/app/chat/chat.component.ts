import {Component, OnDestroy, OnInit} from '@angular/core';
import {ChatMessage} from '../classes/chat-message';
import {User} from '../classes/user';
import {ChatFacadeService} from '../core/facade/chat.facade.service';
import { FormsModule } from '@angular/forms';
import { Bind } from 'primeng/bind';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.less'],
    imports: [FormsModule, Bind, InputText, Button, TranslatePipe]
})
export class ChatComponent implements OnInit, OnDestroy {

  input = '';

  constructor(private chatFacade: ChatFacadeService) {
  }

  get user(): User | null {
    return this.chatFacade.user;
  }

  get messages(): ChatMessage[] {
    return this.chatFacade.messages;
  }

  get admin(): boolean {
    return this.chatFacade.admin;
  }

  get asSystem(): boolean {
    return this.chatFacade.getAsSystem();
  }

  set asSystem(value: boolean) {
    this.chatFacade.setAsSystem(value);
  }

  send(): void {
    this.input = this.chatFacade.send(this.input);
  }

  ngOnInit() {
    this.chatFacade.init();
  }

  ngOnDestroy(): void {
    this.chatFacade.dispose();
  }
}
