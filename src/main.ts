import 'hammerjs';
import {enableProdMode, provideZoneChangeDetection} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
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

