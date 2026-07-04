import {Injectable} from '@angular/core';
import {Observable, forkJoin, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Userdata} from '../../classes/userdata';
import {SocialApiService} from '../api/social-api.service';
import {MessageApiService} from '../api/message-api.service';
import {User} from '../../classes/user';

@Injectable({
  providedIn: 'root'
})
export class UsersListFacadeService {
  constructor(private socialApi: SocialApiService, private messageApi: MessageApiService) {}

  loadInitialState(): Observable<{ usersList: Userdata[]; viewer: User; adminView: boolean }> {
    return forkJoin({
      users: this.socialApi.getAllUsers(),
      outgoing: this.socialApi.getOutgoingRequests(),
      incoming: this.socialApi.getIncomingRequests(),
      viewer: this.messageApi.getProfile(),
      adminView: this.socialApi.isProfileAdmin().pipe(
        map((data) => !!data?.admin),
        catchError(() => of(false))
      ),
      friends: this.socialApi.getFriends(),
      ready: this.socialApi.getReadyUsers(),
      admins: this.socialApi.getAdminUsers().pipe(catchError(() => of([] as string[])))
    }).pipe(
      map(({users, outgoing, incoming, viewer, adminView, friends, ready, admins}) => {
        const outgoingSet = new Set((outgoing ?? []).map((u) => u.login));
        const incomingSet = new Set((incoming ?? []).map((u) => u.login));
        const friendSet = new Set((friends ?? []).map((u) => u.login));
        const readySet = new Set(ready ?? []);
        const adminSet = new Set(admins ?? []);

        const usersList: Userdata[] = (users ?? [])
          .filter((user) => user.login !== viewer.login)
          .map((user) => {
            const entry = new Userdata();
            entry.user = user;
            entry.requested = outgoingSet.has(user.login);
            entry.requesting = incomingSet.has(user.login);
            entry.friend = friendSet.has(user.login);
            entry.admin = adminSet.has(user.login);
            entry.notAdmin = !entry.admin;
            entry.noRelations = !(entry.requested || entry.requesting || entry.friend);
            entry.user.online = readySet.has(user.login);
            entry.user.offline = !entry.user.online;
            return entry;
          });

        return {usersList, viewer, adminView};
      })
    );
  }
}
