import {Routes} from '@angular/router';
import {StartPageComponent} from './start-page/start-page.component';
import {InfoPageComponent} from './info-page/info-page.component';
import {ProfilePageComponent} from './profile-page/profile-page.component';
import {FriendsPageComponent} from './friends-page/friends-page.component';
import {DialogueComponent} from './dialogue/dialogue.component';
import {FightComponent} from './fight/fight.component';

export const appRoutes: Routes = [
  {path: 'start', component: StartPageComponent},
  {path: '', redirectTo: 'start', pathMatch: 'full'},
  {path: 'info', component: InfoPageComponent},
  {path: 'main', component: ProfilePageComponent},
  {path: 'profile', redirectTo: 'main', pathMatch: 'full'},
  {path: 'messages', redirectTo: 'main', pathMatch: 'full'},
  {path: 'friends', component: FriendsPageComponent},
  {path: 'dialogue/:login', component: DialogueComponent},
  {path: 'history', redirectTo: 'main', pathMatch: 'full'},
  {path: 'spells', redirectTo: 'main', pathMatch: 'full'},
  {path: 'fight/:type/:id', component: FightComponent}
];
