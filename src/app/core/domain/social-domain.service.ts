import {Injectable} from '@angular/core';
import {Message} from '../../classes/message';

@Injectable({
  providedIn: 'root'
})
export class SocialDomainService {
  parseOnlineEvent(body: string): { user: string; type: string } | null {
    const i = body.indexOf(':');
    if (i < 0) {
      return null;
    }
    const left = body.substring(0, i);
    const right = body.substring(i + 1);
    const knownTypes = ['online', 'offline', 'new'];
    if (knownTypes.includes(left)) {
      return {user: right, type: left};
    }
    return {user: left, type: right};
  }

  buildUnreadByUser(messages: Message[]): {[login: string]: number} {
    const unreadByUser: {[login: string]: number} = {};
    (messages ?? []).forEach((message) => {
      const sender = message?.sender?.login;
      if (!sender) {
        return;
      }
      unreadByUser[sender] = (unreadByUser[sender] ?? 0) + 1;
    });
    return unreadByUser;
  }
}
