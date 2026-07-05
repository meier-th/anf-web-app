import {Routes} from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'start',
    loadComponent: () => import('./start-page/start-page.component').then(m => m.StartPageComponent)
  },
  {path: '', redirectTo: 'start', pathMatch: 'full'},
  {
    path: 'info',
    loadComponent: () => import('./info-page/info-page.component').then(m => m.InfoPageComponent)
  },
  {
    path: 'main',
    loadComponent: () => import('./profile-page/profile-page.component').then(m => m.ProfilePageComponent)
  },
  {path: 'profile', redirectTo: 'main', pathMatch: 'full'},
  {path: 'messages', redirectTo: 'main', pathMatch: 'full'},
  {
    path: 'friends',
    loadComponent: () => import('./friends-page/friends-page.component').then(m => m.FriendsPageComponent)
  },
  {
    path: 'dialogue/:login',
    loadComponent: () => import('./dialogue/dialogue.component').then(m => m.DialogueComponent)
  },
  {path: 'history', redirectTo: 'main', pathMatch: 'full'},
  {path: 'spells', redirectTo: 'main', pathMatch: 'full'},
  {
    path: 'fight/:type/:id',
    loadComponent: () => import('./fight/fight.component').then(m => m.FightComponent)
  }
];
