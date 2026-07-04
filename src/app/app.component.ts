import {Component} from '@angular/core';
import {MainComponent} from './main/main.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MainComponent],
  template: '<app-main></app-main>'
})
export class AppComponent {}
