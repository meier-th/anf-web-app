import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {MessageService} from 'primeng/api';
import {DialogService} from 'primeng/dynamicdialog';
import {TranslatePipe} from '../services/translate.pipe';
import {MainFacadeService} from '../core/facade/main.facade.service';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';

@Component({
    selector: 'app-main',
    standalone: true,
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.less'],
    providers: [DialogService, MainFacadeService],
    imports: [Bind, Button, RouterOutlet, TranslatePipe]
})
export class MainComponent implements OnInit, OnDestroy {
  constructor(public router: Router, public messageService: MessageService, public facade: MainFacadeService) {}

  ngOnInit() {
    this.facade.init();
  }

  toggleLanguageMenu(event: MouseEvent): void {
    this.facade.toggleLanguageMenu(event);
  }

  setLanguage(language: 'en' | 'ru'): void {
    this.facade.setLanguage(language);
  }

  @HostListener('document:click')
  closeLanguageMenu(): void {
    this.facade.closeLanguageMenu();
  }

  showLoginBlock() {
    this.facade.showLoginBlock();
  }

  loginSuccess(username?: string) {
    this.facade.loginSuccess(username);
  }

  onRegistrationSession(username: string): void {
    this.facade.onRegistrationSession(username);
  }

  logout() {
    this.facade.logout();
  }

  ngOnDestroy(): void {
    this.facade.destroy();
  }

  isFightRoute(): boolean {
    return this.facade.isFightRoute();
  }

  onPrimaryAction(): void {
    this.facade.onPrimaryAction();
  }

  cancelSurrenderConfirm(): void {
    this.facade.cancelSurrenderConfirm();
  }

  confirmSurrender(): void {
    this.facade.confirmSurrender();
  }

  get loggedIn(): boolean { return this.facade.loggedIn; }
  get login(): string { return this.facade.login; }
  get display(): boolean { return this.facade.display; }
  set display(value: boolean) { this.facade.display = value; }
  get showSurrenderConfirm(): boolean { return this.facade.showSurrenderConfirm; }
  get languageMenuOpen(): boolean { return this.facade.languageMenuOpen; }
  get currentLanguage(): 'en' | 'ru' { return this.facade.currentLanguage; }

}
