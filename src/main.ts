import {enableProdMode} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';

import {AppComponent} from './app/app.component';
import {appConfig} from './app/app.config';
import {environment} from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));

// window.onmousewheel = (event: WheelEvent) => {
//   const fps = 50;
//   let value = screen.height / event.wheelDelta > 0 ? fps : -fps;
//   console.log(screen.height);
//   if ((window.pageYOffset + screen.height) % window.innerHeight > 0) {
//     value = ((window.pageYOffset + screen.height) % window.innerHeight) / event.wheelDelta > 0 ? fps : -fps;
//   }
//   setInterval(() => {
//     window.scrollBy(0, value);
//   }, 500 / fps);
//   console.log('kek');
// };

