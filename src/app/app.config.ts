import {APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {HttpClientModule} from '@angular/common/http';
import {provideRouter} from '@angular/router';
import {CookieService} from 'ngx-cookie-service';
import {MessageService} from 'primeng/api';
import {TranslatePipe} from './services/translate.pipe';
import {TranslateService} from './services/translate.service';
import {appRoutes} from './app.routes';

function setupTranslateFactory(service: TranslateService): Function {
  return () => service.use('en');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    importProvidersFrom(HttpClientModule, BrowserAnimationsModule),
    provideRouter(appRoutes),
    CookieService,
    MessageService,
    TranslatePipe,
    TranslateService,
    {
      provide: APP_INITIALIZER,
      useFactory: setupTranslateFactory,
      deps: [TranslateService],
      multi: true
    }
  ]
};
