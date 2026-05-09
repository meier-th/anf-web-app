import {Injectable, computed, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SessionStore {
  private readonly _loggedIn = signal(false);
  private readonly _username = signal('');

  readonly loggedIn = computed(() => this._loggedIn());
  readonly username = computed(() => this._username());

  setSession(loggedIn: boolean, username: string): void {
    this._loggedIn.set(loggedIn);
    this._username.set(username);
  }

  clearSession(): void {
    this._loggedIn.set(false);
    this._username.set('');
  }
}
