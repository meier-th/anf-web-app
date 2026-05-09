import {BrowserModule} from '@angular/platform-browser';
import {NgModule, APP_INITIALIZER} from '@angular/core';
import {AppRoutingModule} from './app-routing.module';
import {MainComponent} from './main/main.component';
import {StartPageComponent} from './start-page/start-page.component';
import {ButtonModule} from 'primeng/button';
import {InfoPageComponent} from './info-page/info-page.component';
import {DynamicDialogModule} from 'primeng/dynamicdialog';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {AuthComponent} from './auth/auth.component';
import {PasswordModule} from 'primeng/password';
import {InputTextModule} from 'primeng/inputtext';
import {MessageService} from 'primeng/api';
import {RadioButtonModule} from 'primeng/radiobutton';
import {PickListModule} from 'primeng/picklist';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {TooltipModule} from 'primeng/tooltip';
import {ProfilePageComponent} from './profile-page/profile-page.component';
import {HttpClientModule} from '@angular/common/http';
import {CookieService} from 'ngx-cookie-service';
import {FormsModule} from '@angular/forms';
import {MessagesComponent} from './messages/messages.component';
import {FriendsPageComponent} from './friends-page/friends-page.component';
import {DialogueComponent} from './dialogue/dialogue.component';
import {ToastModule} from 'primeng/toast';
import {ChatComponent} from './chat/chat.component';
import {QueueComponent} from './queue/queue.component';
import {FightComponent} from './fight/fight.component';
import {CharacterComponent} from './character/character.component';
import {SingleMessageComponent} from './single-message/single-message.component';
import {UsersListComponent} from './users-list/users-list.component';
import {SearchUsersPipe} from './services/search-users.pipe';
import {TranslateService} from './services/translate.service';
import {TranslatePipe} from './services/translate.pipe';
import {RoomComponent} from './room/room.component';
import {AnimalRaceChoiceComponent} from './animal-race-choice/animal-race-choice.component';
import {HistoryComponent} from './history/history.component';
import {SpellsComponent} from './spells/spells.component';
import {FightResultComponent} from './fight-result/fight-result.component';

export function setupTranslateFactory(
  service: TranslateService): Function {
  return () => service.use('en');
}

@NgModule({
  declarations: [
    MainComponent,
    StartPageComponent,
    InfoPageComponent,
    AuthComponent,
    ProfilePageComponent,
    MessagesComponent,
    FriendsPageComponent,
    DialogueComponent,
    ChatComponent,
    QueueComponent,
    FightComponent,
    CharacterComponent,
    SingleMessageComponent,
    UsersListComponent,
    SearchUsersPipe,
    TranslatePipe,
    RoomComponent,
    AnimalRaceChoiceComponent,
    HistoryComponent,
    SpellsComponent,
    FightResultComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ButtonModule,
    DynamicDialogModule,
    BrowserAnimationsModule,
    PasswordModule,
    InputTextModule,
    FormsModule,
    ToastModule,
    RadioButtonModule,
    PickListModule,
    ConfirmDialogModule,
    TooltipModule
  ],
  providers: [CookieService, MessageService, TranslatePipe, TranslateService,
    {
      provide: APP_INITIALIZER,
      useFactory: setupTranslateFactory,
      deps: [TranslateService],
      multi: true
    }],
  bootstrap: [MainComponent]
})
export class AppModule {
}
