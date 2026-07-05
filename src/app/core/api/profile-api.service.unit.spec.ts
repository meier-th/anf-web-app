import {of} from 'rxjs';
import {ApiConfigService} from '../config/api-config.service';
import {ProfileApiService} from './profile-api.service';

describe('ProfileApiService caching', () => {
  it('keeps replaying a stale profile to new callers until clearCache() is called', () => {
    let callCount = 0;
    const fakeHttp = {
      get: () => {
        callCount++;
        return of({login: `user${callCount}`} as any);
      }
    };
    const service = new ProfileApiService(fakeHttp as any, new ApiConfigService());

    let firstLogin: string | undefined;
    service.getProfile().subscribe(user => firstLogin = user.login);
    expect(firstLogin).toBe('user1');

    // Without invalidation, a second caller (e.g. after logging in as someone
    // else) still gets the first user's cached profile.
    let secondLogin: string | undefined;
    service.getProfile().subscribe(user => secondLogin = user.login);
    expect(secondLogin).toBe('user1');
    expect(callCount).toBe(1);

    // This is what MainFacadeService.logout()/loginSuccess() must call so the
    // next user's session gets a fresh profile instead of the previous one.
    service.clearCache();

    let thirdLogin: string | undefined;
    service.getProfile().subscribe(user => thirdLogin = user.login);
    expect(thirdLogin).toBe('user2');
    expect(callCount).toBe(2);
  });
});
